/*
 * Offline for the part of the app that was never online to begin with.
 *
 * The pitch has always been that the spreadsheet lives in your browser and is never uploaded. That
 * was true and the app still could not open on a train, which is a fair thing to hold against it:
 * the document was local and the *program* was not.
 *
 * Deliberately small, and deliberately hand-written. A generated service worker is a few hundred
 * lines nobody in this repository could answer questions about, and the caching policy is the only
 * interesting decision here — everything else is boilerplate that would obscure it.
 *
 * The policy, and why:
 *
 * - **Navigations: network first, cache as a fallback.** A stale HTML document is the one thing
 *   that must not be served while the network is fine: it carries the CSP nonce and the script
 *   URLs for a build that may no longer exist. Offline, the cached copy is served whole — response
 *   and headers together — so its nonce still matches its own inline scripts.
 * - **Build assets: cache first.** `/_next/static/*` is content-addressed; a given URL never
 *   changes what it holds, so a hit is always correct and a miss is a new build.
 * - **Everything else — API routes, the AI assistant, live data, Supabase: not cached at all.**
 *   They are the parts that *need* the network, and a cached answer from them would be a stale
 *   number presented as a current one, which is this project's least acceptable failure.
 */
const VERSION = "exceltogo-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/** Fetched on install so a first visit online is enough to make the app openable offline. */
const PRECACHE = ["/app", "/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One at a time and forgiving: a single 404 in `addAll` throws the whole install away, and
      // an app that fails to install its worker because of one URL is worse than one page short.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* offline during install, or a route that is not there; either way, carry on */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Anything from an older VERSION is from a build whose assets no longer exist.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

const isBuildAsset = (url) => url.pathname.startsWith("/_next/static/");

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Same origin only. The assistant talks to api.anthropic.com and the cloud to Supabase, and a
  // service worker sitting in front of either would be caching somebody's data.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(ASSETS);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(SHELL);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          // Offline. The cached copy of this page, or of the app, or — last — whatever the browser
          // does with a failed navigation, which is its own offline page rather than a blank one.
          const cached = (await caches.match(request)) ?? (await caches.match("/app"));
          if (cached) return cached;
          throw new Error("offline and nothing cached");
        }
      })()
    );
  }
});
