const api = typeof browser !== "undefined" ? browser : chrome;
const status = document.getElementById("status");
const out = document.getElementById("out");
const copyBtn = document.getElementById("copy");
const openBtn = document.getElementById("open");
let payload = null;

function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

api.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
  const tab = tabs[0];
  if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
    status.textContent = "Open an x.com profile tab first.";
    return;
  }
  try {
    const response = await api.tabs.sendMessage(tab.id, { type: "spammeraegis-read" });
    payload = response;
    out.textContent = JSON.stringify(response, null, 2);
    status.textContent = response?.username ? `@${response.username}` : "Captured this page";
    api.runtime.sendMessage({ type: "spammeraegis-capture", payload: response });
  } catch {
    status.textContent = "Reload the X tab, then try again.";
  }
});

copyBtn.addEventListener("click", async () => {
  if (!payload) return;
  const text = JSON.stringify(payload);
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied — paste into SpammerAegis Capture or Crawl.";
  } catch {
    prompt("Copy this", text);
  }
});

openBtn.addEventListener("click", async () => {
  if (!payload) return;
  const stored = await api.storage.local.get(["deskUrl"]);
  const hash = `spammeraegis=${encodePayload(payload)}`;
  try {
    await navigator.clipboard.writeText(`#${hash}`);
    status.textContent = "Hash copied. Open SpammerAegis and it will ingest, or set deskUrl in storage.";
  } catch {
    status.textContent = hash;
  }
  if (stored.deskUrl) {
    const url = `${String(stored.deskUrl).replace(/\/$/, "")}/#${hash}`;
    api.tabs.create({ url });
  }
});
