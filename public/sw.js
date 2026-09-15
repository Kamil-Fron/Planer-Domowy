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
  const notifData = data.data || {};
  const targetUrl = notifData.url || '/';

  // Build clean options for maximum cross-platform compatibility (iOS WebKit + Android Chrome + Desktop)
  const options = {
    body: data.body || 'Nowe powiadomienie od domownika',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [180, 80, 180],
    tag: data.tag || `push-${Date.now()}`,
    renotify: true,
    data: {
      ...notifData,
      url: targetUrl,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('Błąd showNotification w Service Workerze:', err);
    })
  );
});

// Direct message from main thread to show notification via service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Planer Budżetu Domowego';
    const options = {
      body: event.data.body || 'Powiadomienie testowe',
      icon: event.data.icon || '/pwa-192x192.png',
      badge: event.data.badge || '/pwa-192x192.png',
      vibrate: [180, 80, 180],
      tag: `test-${Date.now()}`,
      renotify: true,
      data: event.data.data || { url: '/' },
      ...event.data.options,
    };
    event.waitUntil(
      self.registration.showNotification(title, options).catch((err) => {
        console.warn('Błąd showNotification z wiadomości w SW:', err);
      })
    );
  }
});

// Handle Notification Click (Deep linking directly to specific transaction/tab)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab or standalone window of this app is open, focus it and post navigation event
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('postMessage' in client) {
            client.postMessage({
              type: 'NAVIGATE_FROM_NOTIFICATION',
              targetTab: notificationData.targetTab || 'transactions',
              notificationData: notificationData,
            });
          }
          return client.focus();
        }
      }
      // If no tab is open (e.g. app was closed on mobile), open a new window to targetUrl with parameters
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
