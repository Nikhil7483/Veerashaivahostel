// Service Worker for Veerashaiva Lingayath Boys Hostel Web Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Veerashaiva Hostel ❤️',
    message: 'New update from hostel!',
    link: '/student/dashboard'
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    if (event.data) {
      data.message = event.data.text();
    }
  }

  const title = data.title || 'Veerashaiva Hostel ❤️';
  const message = data.message || data.body || 'You have a new hostel update.';
  const link = data.link || '/student/dashboard';

  const options = {
    body: message,
    icon: '/favicon.png',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    tag: `hostel-notif-${Date.now()}`,
    renotify: true,
    data: {
      url: link
    },
    actions: [
      { action: 'open', title: 'Open Hostel Portal' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && urlToOpen) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
