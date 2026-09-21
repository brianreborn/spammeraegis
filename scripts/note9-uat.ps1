<#
  Hold $HOME/$ADBUUID, reverse the desk port onto the Note 9, open the page, screenshot.
#>
param(
  [string]$AdbUuid = $(if ($env:ADBUUID) { $env:ADBUUID } else { "27841130ae1c7ece" }),
  [int]$Port = 18080,
  [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "adb-lock.ps1")

$OutDir = Join-Path (Split-Path $PSScriptRoot -Parent) "uat-artifacts"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Acquire-AdbLock -AdbUuid $AdbUuid -Purpose "spammeraegis-note9-uat" | Out-Null
try {
  Update-AdbLockHeartbeat -AdbUuid $AdbUuid
  if (-not (Test-Path -LiteralPath $Adb)) { throw "adb not found at $Adb" }
  & $Adb start-server | Out-Null
  Write-Output ((& $Adb devices -l) -join "`n")
  $state = (& $Adb -s $AdbUuid get-state 2>&1 | Out-String).Trim()
  if ($state -ne "device") { throw "Note 9 $AdbUuid state=$state (want device)" }

  cmd /c "`"$Adb`" -s $AdbUuid reverse --remove tcp:$Port >nul 2>&1"
  cmd /c "`"$Adb`" -s $AdbUuid reverse tcp:$Port tcp:$Port"
  if ($LASTEXITCODE -ne 0) { throw "adb reverse failed ($LASTEXITCODE)" }
  Write-Output "REVERSE tcp:$Port -> host:$Port"

  $url = "http://127.0.0.1:$Port/"
  & $Adb -s $AdbUuid shell am start -a android.intent.action.VIEW -d $url | Out-Null
  Start-Sleep -Seconds 5
  Update-AdbLockHeartbeat -AdbUuid $AdbUuid

  $remote = "/sdcard/Download/spammeraegis-uat.png"
  & $Adb -s $AdbUuid shell screencap -p $remote
  $local = Join-Path $OutDir "note9-desk.png"
  & $Adb -s $AdbUuid pull $remote $local
  & $Adb -s $AdbUuid shell rm -f $remote | Out-Null
  Write-Output "SCREENSHOT $local"
  Write-Output "PHONE $url"
} finally {
  Release-AdbLock -AdbUuid $AdbUuid
}
