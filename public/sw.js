// Service Worker for Planer Budżetu Domowego & PWA Background Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Background Push Notification Event (fires even when the app is closed or screen is off!)
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

  // Primary options object
  const primaryOptions = {
    body: data.body || 'Nowe powiadomienie z Twojego budżetu domowego',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || `push-${Date.now()}`,
    renotify: true,
    data: {
      ...notifData,
      url: targetUrl,
    },
  };

  event.waitUntil(
    (async () => {
      try {
        // Attempt full options
        await self.registration.showNotification(title, primaryOptions);
      } catch (err) {
        console.warn('Pierwsza próba showNotification nie powiodła się, ponawiam z bezpiecznymi opcjami podstawowymi:', err);
        try {
          // Minimalist fallback (avoids issues with vibrate/renotify on iOS WebKit)
          await self.registration.showNotification(title, {
            body: data.body || 'Nowe powiadomienie',
            icon: '/pwa-192x192.png',
            data: {
              ...notifData,
              url: targetUrl,
            },
          });
        } catch (fatalErr) {
          console.error('Krytyczny błąd showNotification w Service Workerze:', fatalErr);
        }
      }
    })()
  );
});

// Automatic resubscription if browser rotates push subscription in background
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((newSubscription) => {
        return fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSubscription.toJSON() }),
        });
      })
      .catch((err) => {
        console.warn('Ostrzeżenie przy pushsubscriptionchange:', err);
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

// Background Sync and Periodic Background Sync (PWA Background Refresh)
self.addEventListener('sync', (event) => {
  if (event.tag === 'budget-sync' || event.tag === 'budget-refresh') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('[SW] Background sync triggered in background');
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'budget-periodic-refresh') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('[SW] Periodic background refresh triggered');
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
