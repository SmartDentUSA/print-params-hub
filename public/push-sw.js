/* Smart Dent — service worker exclusivo de notificações push (sem cache/offline). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Smart Dent";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon-192x192.png",
    badge: "/favicon-96x96.png",
    image: data.image || undefined,
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.allSettled(clientsList.map((client) => client.postMessage({
        type: "SMARTDENT_PUSH_RECEIVED",
        payload: {
          title,
          body: options.body,
          image: options.image,
          icon: options.icon,
          url: options.data.url,
          tag: options.tag,
        },
      })));
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((c) => "focus" in c);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "SMARTDENT_PUSH_OPEN", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});