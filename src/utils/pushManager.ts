// Web Push Notification Manager for Background & Mobile Notifications

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Register the service worker at /sw.js
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    // Wait for the active worker
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn('Błąd rejestracji Service Workera:', error);
    return null;
  }
}

// Fetch VAPID public key from the backend
let cachedVapidKey: string | null = null;
export async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const res = await fetch('/api/push-vapid-public-key');
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.publicKey) {
      cachedVapidKey = data.publicKey;
      return cachedVapidKey;
    }
  } catch (err) {
    console.warn('Nie udało się pobrać klucza VAPID z serwera:', err);
  }
  return null;
}

// Subscribe device to Push Notifications
export async function subscribeToPushNotifications(options: {
  householdId: string;
  userId: string;
  userName: string;
}): Promise<{ subscription: PushSubscription | null; error?: string }> {
  if (!isPushSupported()) {
    return { subscription: null, error: 'Powiadomienia Push nie są wspierane w tej przeglądarce.' };
  }

  try {
    // 1. Ask permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { subscription: null, error: 'Brak zgody na powiadomienia w przeglądarce.' };
    }

    // 2. Register SW
    const registration = await registerServiceWorker();
    if (!registration) {
      return { subscription: null, error: 'Nie udało się zarejestrować Service Workera.' };
    }

    // 3. Get VAPID Key
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      return { subscription: null, error: 'Serwer nie udostępnił klucza VAPID.' };
    }

    // 4. Subscribe or retrieve existing subscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // 5. Send subscription to server
    const payload = {
      subscription: subscription.toJSON(),
      householdId: options.householdId,
      userId: options.userId,
      userName: options.userName,
    };

    const serverRes = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!serverRes.ok) {
      console.warn('Serwer zwrócił błąd podczas zapisu subskrypcji push');
    }

    return { subscription };
  } catch (err: any) {
    console.error('Błąd włączania powiadomień push:', err);
    return { subscription: null, error: err?.message || 'Wystąpił błąd podczas rejestracji push.' };
  }
}

// Unsubscribe device from Push Notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      try {
        await fetch('/api/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      } catch {}
      return true;
    }
  } catch (e) {
    console.warn('Błąd wyrejestrowywania push:', e);
  }
  return false;
}

// Send push notification to all OTHER members of the household
export async function sendPushNotificationToHousehold(params: {
  householdId: string;
  senderUserId: string;
  senderUserName: string;
  title: string;
  body: string;
  targetTab?: string;
  extraSubscriptions?: any[];
  data?: any;
}): Promise<{ success: boolean; recipientsCount?: number }> {
  try {
    const res = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      return { success: false };
    }
    const result = await res.json();
    return result;
  } catch (err) {
    console.warn('Błąd wysyłania powiadomienia push przez serwer:', err);
    return { success: false };
  }
}
