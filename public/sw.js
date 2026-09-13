// Service Worker for Planer Budżetu Domowego & PWA Background Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Background Push Notification Event (fires even when the app is closed!)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Planer Budżetu Domowego';
  const options = {
    body: data.body || 'Nowe powiadomienie od domownika',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: 'budget-' + Date.now(),
    renotify: true,
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('Błąd showNotification w Service Workerze:', err);
    })
  );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab or standalone window of this app is open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          if (notificationData.targetTab && 'postMessage' in client) {
            client.postMessage({
              type: 'NAVIGATE_FROM_NOTIFICATION',
              targetTab: notificationData.targetTab,
              notificationData: notificationData
            });
          }
          return client.focus();
        }
      }
      // If no tab is open, open a new window to the application
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
