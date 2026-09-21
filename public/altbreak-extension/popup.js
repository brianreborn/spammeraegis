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
    const response = await api.tabs.sendMessage(tab.id, { type: "altbreak-read" });
    payload = response;
    out.textContent = JSON.stringify(response, null, 2);
    status.textContent = response?.username ? `@${response.username}` : "Captured this page";
    api.runtime.sendMessage({ type: "altbreak-capture", payload: response });
  } catch {
    status.textContent = "Reload the X tab, then try again.";
  }
});

copyBtn.addEventListener("click", async () => {
  if (!payload) return;
  const text = JSON.stringify(payload);
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied — paste into Altbreak Capture or Crawl.";
  } catch {
    prompt("Copy this", text);
  }
});

openBtn.addEventListener("click", async () => {
  if (!payload) return;
  const stored = await api.storage.local.get(["deskUrl"]);
  const desk = stored.deskUrl || "https://x.com";
  /* Desk URL is the Altbreak PWA origin. Default opens a hash the user can paste. */
  const hash = `altbreak=${encodePayload(payload)}`;
  const url = `${String(desk).replace(/\/$/, "")}/#${hash}`;
  try {
    await navigator.clipboard.writeText(`#${hash}`);
    status.textContent = "Hash copied. Open Altbreak and it will ingest, or set deskUrl in storage.";
  } catch {
    status.textContent = hash;
  }
  if (stored.deskUrl) api.tabs.create({ url });
});
