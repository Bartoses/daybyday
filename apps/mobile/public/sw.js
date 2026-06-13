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

// Focus or open the app when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
