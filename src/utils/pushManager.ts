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

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Get active service worker registration safely with timeout to avoid Promise deadlocks
export async function getActiveServiceWorker(timeoutMs = 2500): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const readyReg = await Promise.race([readyPromise, timeoutPromise]);
    if (readyReg) return readyReg;

    // If ready timed out, check existing registrations
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      return registrations[0];
    }

    // Try registering directly
    const directReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return directReg;
  } catch (err) {
    console.warn('getActiveServiceWorker warning:', err);
    return null;
  }
}

// Register the service worker at /sw.js
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    // Wait with timeout for active worker
    const readyWorker = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    return readyWorker || registration;
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
  if (isRunningInIframe() && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return {
      subscription: null,
      error: 'Przeglądarka blokuje prośbę o powiadomienia w oknie podglądu (iframe). Otwórz aplikację w nowej karcie lub bezpośrednio w telefonie.',
    };
  }

  if (!isPushSupported()) {
    if (isAppleDevice() && !isStandalonePWA()) {
      return {
        subscription: null,
        error: 'Na iPhone (iOS) powiadomienia push działają po dodaniu aplikacji do ekranu początkowego. Kliknij Udostępnij (ikona ze strzałką) -> Dodaj do ekranu początkowego.',
      };
    }
    return { subscription: null, error: 'Powiadomienia Push nie są wspierane w tej przeglądarce.' };
  }

  try {
    // 1. Ask permission
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        subscription: null,
        error:
          permission === 'denied'
            ? 'Powiadomienia są zablokowane w przeglądarce dla tej witryny. Kliknij ikonę kłódki/ustawień obok paska adresu i włącz Powiadomienia.'
            : 'Nie udzielono zgody na powiadomienia w przeglądarce.',
      };
    }

    // 2. Register SW
    const registration = await registerServiceWorker();
    if (!registration) {
      return { subscription: null, error: 'Nie udało się zarejestrować Service Workera w przeglądarce.' };
    }

    // 3. Get VAPID Key
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      return { subscription: null, error: 'Serwer nie udostępnił publicznego klucza VAPID.' };
    }

    // 4. Check existing subscription and reuse if key matches
    const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await registration.pushManager.getSubscription();

    let needsNewSubscription = !subscription;
    if (subscription) {
      try {
        const existingKey = (subscription as any).options?.applicationServerKey;
        if (existingKey) {
          const existingBytes = new Uint8Array(existingKey);
          if (existingBytes.length !== convertedVapidKey.length || !existingBytes.every((b, i) => b === convertedVapidKey[i])) {
            needsNewSubscription = true;
          }
        }
      } catch {
        needsNewSubscription = true;
      }
    }

    if (needsNewSubscription) {
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch {}
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    if (!subscription) {
      return { subscription: null, error: 'Nie udało się uzyskać subskrypcji push z przeglądarki.' };
    }

    // 5. Send subscription to server
    const subJson = subscription.toJSON();
    const payload = {
      subscription: subJson,
      householdId: options.householdId,
      userId: options.userId,
      userName: options.userName,
    };

    try {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Ostrzeżenie przy zapisie subskrypcji na serwerze:', e);
    }

    return { subscription };
  } catch (err: any) {
    console.error('Błąd włączania powiadomień push:', err);
    return { subscription: null, error: err?.message || 'Wystąpił błąd podczas rejestracji push.' };
  }
}

// Send test push directly via backend Web Push service
export async function sendTestPushNotification(options?: {
  subscription?: PushSubscription | any | null;
  householdId?: string;
  userId?: string;
  extraSubscriptions?: any[];
}): Promise<{ success: boolean; message?: string; error?: string; sentCount?: number }> {
  try {
    let subData: any = undefined;
    if (options?.subscription) {
      subData = typeof options.subscription.toJSON === 'function'
        ? options.subscription.toJSON()
        : options.subscription;
    }

    const res = await fetch('/api/test-push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subData,
        householdId: options?.householdId,
        userId: options?.userId,
        extraSubscriptions: options?.extraSubscriptions,
        title: '🔔 Test powiadomienia w telefonie',
        body: 'Powiadomienia w tle działają prawidłowo!',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data?.error || 'Błąd wysyłki testowego powiadomienia.',
        sentCount: data?.sentCount || 0,
      };
    }
    return { success: true, message: data.message, sentCount: data.sentCount };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Błąd połączenia z serwerem.' };
  }
}

// Unsubscribe device from Push Notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await getActiveServiceWorker(2500);
    if (!registration) return false;
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

// Get existing push subscription safely
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await getActiveServiceWorker(2500);
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
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
