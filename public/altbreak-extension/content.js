(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;

  function textOf(sel) {
    const el = document.querySelector(sel);
    return el ? (el.innerText || el.textContent || "").trim() : "";
  }

  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") || "" : "";
  }

  function readProfile() {
    const path = location.pathname.split("/").filter(Boolean)[0] || "";
    const reserved = new Set([
      "home", "explore", "search", "i", "settings", "notifications", "messages",
      "compose", "login", "intent", "hashtag", "tos", "privacy",
    ]);
    const username = reserved.has(path.toLowerCase()) ? "" : path;
    const nameBlock = textOf('[data-testid="UserName"]');
    const lines = nameBlock.split("\n").map((s) => s.trim()).filter(Boolean);
    const displayName = lines[0] || meta("og:title").split("(")[0].trim();
    const bio = textOf('[data-testid="UserDescription"]') || meta("og:description");
    let id;
    const follow = document.querySelector('a[href*="/intent/follow"]');
    const href = follow ? follow.getAttribute("href") || "" : "";
    const m = href.match(/user_id=(\d+)/);
    if (m) id = m[1];
    return {
      username,
      displayName,
      bio,
      id,
      url: location.href,
    };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "altbreak-read") {
      sendResponse(readProfile());
    }
  });
})();
