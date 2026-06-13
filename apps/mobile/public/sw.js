// Service worker: enables PWA installability (Chrome requires a registered SW
// with a fetch handler) and handles Web Push notifications.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Pass-through fetch (no offline caching yet).
self.addEventListener("fetch", () => {});

// Show an incoming push as a notification.
self.addEventListener("push", (event) => {
  let data = { title: "DaybyDay", body: "You have a new tip.", url: "/today" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/today" },
    }),
  );
});

// Focus or open the right destination when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url = (event.notification.data && event.notification.data.url) || "/today";

  // Normalize: a bare domain (espn.com / www.espn.com) becomes an https URL;
  // a "/path" stays in-app; a full http(s) URL is used as-is.
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    url = "https://" + url;
  }
  const isExternal = /^https?:\/\//i.test(url);
  const target = isExternal ? url : new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      if (isExternal) {
        await self.clients.openWindow(target);
        return;
      }
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          try {
            await client.navigate(target);
          } catch (_e) {
            /* navigation across states can throw; focus anyway */
          }
          return client.focus();
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
