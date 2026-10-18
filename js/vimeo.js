/* Vimeo URL, oEmbed thumbnail loading, and safe caching utilities. */
(function () {
  "use strict";
  const memoryCache = new Map();
  const STORAGE_KEY = "study-notes:vimeo-thumbnails:v1";

  function normalizeVimeoId(value) {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    // Accept a numeric Vimeo ID and preserve the optional private hash.
    const match = raw.match(/^(\d+)(?:\?([^#\s]*))?$/);
    if (!match) return null;
    const params = new URLSearchParams(match[2] || "");
    const query = params.toString();
    return { id: match[1], query, raw: match[1] + (query ? "?" + query : "") };
  }

  function playerUrl(value, autoplay) {
    const parsed = normalizeVimeoId(value);
    if (!parsed) return null;
    const url = new URL("https://player.vimeo.com/video/" + parsed.id);
    const privateParams = new URLSearchParams(parsed.query);
    privateParams.forEach((v, k) => url.searchParams.set(k, v));
    if (autoplay) url.searchParams.set("autoplay", "1");
    url.searchParams.set("title", "0");
    url.searchParams.set("byline", "0");
    url.searchParams.set("portrait", "0");
    return url.toString();
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }
  function writeCache(cache) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  async function thumbnail(value) {
    const parsed = normalizeVimeoId(value);
    if (!parsed) return null;
    const key = parsed.raw;
    if (memoryCache.has(key)) return memoryCache.get(key);
    const cached = readCache()[key];
    if (typeof cached === "string" && cached.startsWith("https://")) {
      memoryCache.set(key, cached);
      return cached;
    }
    const sourceUrl = "https://vimeo.com/" + parsed.id + (parsed.query ? "?" + parsed.query : "");
    const endpoint = "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent(sourceUrl);
    const task = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(endpoint, { signal: controller.signal, mode: "cors" });
        if (!response.ok) return null;
        const data = await response.json();
        const url = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
        if (url && /^https:\/\//i.test(url)) {
          const all = readCache();
          all[key] = url;
          writeCache(all);
          return url;
        }
        return null;
      } catch (_) { return null; }
      finally { clearTimeout(timeout); }
    })();
    memoryCache.set(key, task);
    const result = await task;
    memoryCache.set(key, result);
    return result;
  }

  window.VimeoUtils = { normalizeVimeoId, playerUrl, thumbnail };
})();