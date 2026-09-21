/* Dual MV3 background: Chromium service worker + Firefox event page. */
const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "spammeraegis-capture") return;
  api.storage.local
    .get(["captures"])
    .then((data) => {
      const captures = Array.isArray(data.captures) ? data.captures : [];
      captures.unshift({ ...msg.payload, capturedAt: new Date().toISOString() });
      return api.storage.local.set({ captures: captures.slice(0, 50), last: msg.payload });
    })
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});
