// Minimal service worker. A registered SW with a fetch handler is required for
// Chrome/Android to treat the app as installable. We pass requests straight
// through (no caching yet) to keep it simple and always-fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pass-through: let the network handle everything. Offline caching can be
  // added here later.
});
