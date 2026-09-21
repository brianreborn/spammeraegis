<#
.SYNOPSIS
  Exclusive lock for a USB ADB device: $HOME/$ADBUUID

.DESCRIPTION
  Dot-source this file, then call Acquire-AdbLock / Release-AdbLock /
  Get-AdbLockStatus. The lock file is $HOME/$ADBUUID with no extension.
  Default UUID is the Note 9 serial 27841130ae1c7ece.

  Steal only when the holder pid is dead or heartbeat is older than StaleSeconds.
  Other agents on this host must take the same lock before they use the device.
#>

function Get-AdbUuid {
  param([string]$AdbUuid)
  if ($AdbUuid) { return $AdbUuid }
  if ($env:ADBUUID) { return $env:ADBUUID }
  return "27841130ae1c7ece"
}

function Get-AdbLockPath {
  param([string]$AdbUuid)
  return (Join-Path $HOME (Get-AdbUuid -AdbUuid $AdbUuid))
}

function Read-AdbLock {
  param([string]$LockPath)
  if (-not (Test-Path -LiteralPath $LockPath)) { return $null }
  try {
    return Get-Content -LiteralPath $LockPath -Raw -Encoding utf8 | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Test-AdbPidAlive {
  param([int]$ProcId)
  if ($ProcId -le 0) { return $false }
  try {
    $null = Get-Process -Id $ProcId -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Test-AdbLockStale {
  param($Lock, [int]$StaleSeconds = 120)
  if (-not $Lock) { return $true }
  if (-not (Test-AdbPidAlive -ProcId ([int]$Lock.pid))) { return $true }
  $hb = $Lock.heartbeat_at
  if (-not $hb) { $hb = $Lock.acquired_at }
  if (-not $hb) { return $true }
  try {
    $when = [datetime]::Parse($hb.ToString(), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
  } catch {
    return $true
  }
  return ((Get-Date).ToUniversalTime() - $when).TotalSeconds -gt $StaleSeconds
}

function Write-AdbLockFile {
  param([string]$LockPath, [hashtable]$Obj)
  $json = $Obj | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($LockPath, $json, [System.Text.UTF8Encoding]::new($false))
}

function Get-AdbLockStatus {
  param([string]$AdbUuid, [int]$StaleSeconds = 120)
  $path = Get-AdbLockPath -AdbUuid $AdbUuid
  $lock = Read-AdbLock -LockPath $path
  if (-not $lock) { return [pscustomobject]@{ State = "FREE"; Path = $path; Lock = $null } }
  $stale = Test-AdbLockStale -Lock $lock -StaleSeconds $StaleSeconds
  return [pscustomobject]@{
    State = $(if ($stale) { "STALE" } else { "HELD" })
    Path  = $path
    Lock  = $lock
  }
}

function Acquire-AdbLock {
  param(
    [string]$AdbUuid,
    [string]$Purpose = "spammeraegis-uat",
    [int]$StaleSeconds = 120,
    [string]$Holder
  )
  $uuid = Get-AdbUuid -AdbUuid $AdbUuid
  $path = Get-AdbLockPath -AdbUuid $uuid
  if (-not $Holder) { $Holder = "{0}@{1}/spammeraegis" -f $env:USERNAME, $env:COMPUTERNAME }
  $now = (Get-Date).ToUniversalTime().ToString("o")
  $payload = @{
    adbuuid      = $uuid
    holder       = $Holder
    pid          = $PID
    acquired_at  = $now
    heartbeat_at = $now
    purpose      = $Purpose
    exclusive    = $true
  }

  if (-not (Test-Path -LiteralPath $path)) {
    try {
      $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      $bytes = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress))
      $fs.Write($bytes, 0, $bytes.Length)
      $fs.Close()
      Write-Host "ACQUIRED $path pid=$PID"
      return $path
    } catch [System.IO.IOException] {
      # lost the race
    }
  }

  $lock = Read-AdbLock -LockPath $path
  if ($lock -and [int]$lock.pid -eq $PID) {
    Write-Host "HELD_SELF $path"
    return $path
  }
  if ($lock -and -not (Test-AdbLockStale -Lock $lock -StaleSeconds $StaleSeconds)) {
    throw ("BUSY ADB lock {0} holder={1} pid={2} purpose={3}" -f $path, $lock.holder, $lock.pid, $lock.purpose)
  }
  Write-AdbLockFile -LockPath $path -Obj $payload
  Write-Host "STOLEN $path pid=$PID"
  return $path
}

function Update-AdbLockHeartbeat {
  param([string]$AdbUuid, [int]$StaleSeconds = 120)
  $path = Get-AdbLockPath -AdbUuid $AdbUuid
  $lock = Read-AdbLock -LockPath $path
  if (-not $lock) { throw "MISSING $path" }
  if ([int]$lock.pid -ne $PID -and -not (Test-AdbLockStale -Lock $lock -StaleSeconds $StaleSeconds)) {
    throw ("REFUSED heartbeat holder={0} pid={1}" -f $lock.holder, $lock.pid)
  }
  Write-AdbLockFile -LockPath $path -Obj @{
    adbuuid      = $lock.adbuuid
    holder       = $lock.holder
    pid          = $PID
    acquired_at  = $lock.acquired_at
    heartbeat_at = (Get-Date).ToUniversalTime().ToString("o")
    purpose      = $lock.purpose
    exclusive    = $true
  }
}

function Release-AdbLock {
  param([string]$AdbUuid, [int]$StaleSeconds = 120)
  $path = Get-AdbLockPath -AdbUuid $AdbUuid
  $lock = Read-AdbLock -LockPath $path
  if (-not $lock) {
    Write-Host "ALREADY_FREE $path"
    return
  }
  $mine = ([int]$lock.pid -eq $PID) -or (Test-AdbLockStale -Lock $lock -StaleSeconds $StaleSeconds)
  if (-not $mine) {
    throw ("REFUSED release holder={0} pid={1}" -f $lock.holder, $lock.pid)
  }
  Remove-Item -LiteralPath $path -Force
  Write-Host "RELEASED $path"
}

if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name -or $args.Count -gt 0) {
  # CLI: powershell -File adb-lock.ps1 acquire|release|status
  $action = $args[0]
  if ($action -eq "status") {
    $s = Get-AdbLockStatus
    Write-Output ("{0} {1}" -f $s.State, $s.Path)
    if ($s.Lock) { Write-Output ("holder={0} pid={1} purpose={2}" -f $s.Lock.holder, $s.Lock.pid, $s.Lock.purpose) }
    if ($s.State -eq "HELD") { exit 2 } else { exit 0 }
  }
}
