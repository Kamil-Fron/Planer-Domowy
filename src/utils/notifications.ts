import { AppNotification, Bill, BudgetLimit, Transaction } from '../types';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Przeglądarka nie obsługuje powiadomień Web Notifications.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export async function sendBrowserPushNotification(title: string, options?: NotificationOptions) {
  // Wibracja telefonu przy powiadomieniu (wspierana na urządzeniach mobilnych z Androidem)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([180, 80, 180]);
    } catch {
      // Ignoruj jeśli zablokowane
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    // 1. Priorytet dla telefonów / Service Workera (na mobilnym Chrome wywołanie new Notification() rzuca błąd "Illegal constructor" i wymaga serviceWorkerRegistration.showNotification)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
        ]);

        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [180, 80, 180],
            tag: `notif-${Date.now()}`,
            renotify: true,
            ...options,
          } as NotificationOptions);
          return;
        }

        // Spróbuj także wysłać wiadomość do aktywnego workera
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: {
              ...options,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
            },
          });
        }
      } catch (err) {
        console.warn('Próba wysłania powiadomienia mobilnego przez Service Worker nie powiodła się, sprawdzam fallback:', err);
      }
    }

    // 2. Standardowy fallback przeglądarkowy dla desktopu
    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } catch (e) {
      console.warn('Błąd podczas wysyłania powiadomienia przeglądarki:', e);
    }
  }
}

export function checkAndTriggerBillNotifications(bills: Bill[]): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  bills.forEach((bill) => {
    if (bill.status === 'paid') return;
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 2 && diffDays >= 0) {
      sendBrowserPushNotification(`Przypomnienie: Rachunek ${bill.name}`, {
        body: `Termin płatności (${bill.amount.toFixed(2)} zł) upływa ${diffDays === 0 ? 'dzisiaj' : `za ${diffDays} dni`} (${bill.dueDate}).`,
      });
    }
  });
}

/**
 * Tworzy nowe powiadomienie o aktywności domownika/użytkownika
 */
export function createActivityNotification(
  title: string,
  message: string,
  authorName?: string,
  type: AppNotification['type'] = 'activity',
  relatedId?: string
): AppNotification {
  const notif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    type,
    date: new Date().toISOString(),
    read: false,
    authorName,
    relatedId,
  };

  // Wyślij także push przeglądarkowy
  sendBrowserPushNotification(title, { body: message });

  return notif;
}

export function generateAutomatedNotifications(
  bills: Bill[],
  transactions: Transaction[],
  budgetLimits: BudgetLimit[],
  existingNotifications: AppNotification[] = []
): AppNotification[] {
  // Only keep manual/activity notifications that have real content (exclude automated stubs)
  const manualNotifications = existingNotifications.filter(
    (n) =>
      !n.id.startsWith('bill-') &&
      !n.id.startsWith('budget-exceeded-') &&
      !n.id.startsWith('budget-warning-') &&
      Boolean(n.title && n.title.trim())
  );

  const newNotifications: AppNotification[] = [...manualNotifications];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isMarkedRead = (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const localReadIds: string[] = JSON.parse(localStorage.getItem('app_read_notification_ids') || '[]');
        if (localReadIds.includes(key)) return true;
      }
    } catch {}

    const found = existingNotifications.find((n) => n.id === key);
    return found ? Boolean(found.read) : false;
  };

  // 1. Check Bills Due Dates
  bills.forEach((bill) => {
    if (bill.status === 'paid') return;

    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const billNotificationKey = `bill-${bill.id}-${bill.dueDate}-${diffDays <= 0 ? 'overdue' : 'due'}`;
    const isRead = isMarkedRead(billNotificationKey);

    if (diffDays < 0) {
      // Overdue
      const notif: AppNotification = {
        id: billNotificationKey,
        title: `⚠️ Zaległy rachunek: ${bill.name}`,
        message: `Termin płatności minął ${Math.abs(diffDays)} dni temu (${bill.dueDate}). Kwota: ${bill.amount.toFixed(2)} PLN.`,
        type: 'bill_overdue',
        date: new Date().toISOString(),
        read: isRead,
        relatedId: bill.id,
        targetTab: 'bills',
      };
      newNotifications.unshift(notif);
      if (!isRead) {
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    } else if (diffDays === 0) {
      // Due today
      const notif: AppNotification = {
        id: billNotificationKey,
        title: `🔔 Dzisiaj termin płatności: ${bill.name}`,
        message: `Rachunek na kwotę ${bill.amount.toFixed(2)} PLN (${bill.provider}) przypada na dzisiaj!`,
        type: 'bill_due',
        date: new Date().toISOString(),
        read: isRead,
        relatedId: bill.id,
        targetTab: 'bills',
      };
      newNotifications.unshift(notif);
      if (!isRead) {
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    } else if (diffDays <= 3) {
      // Due in 1-3 days
      const notif: AppNotification = {
        id: billNotificationKey,
        title: `⏰ Zbliża się płatność: ${bill.name}`,
        message: `Za ${diffDays} dni mija termin płatności (${bill.dueDate}) na kwotę ${bill.amount.toFixed(2)} PLN.`,
        type: 'bill_due',
        date: new Date().toISOString(),
        read: isRead,
        relatedId: bill.id,
        targetTab: 'bills',
      };
      newNotifications.unshift(notif);
      if (!isRead) {
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    }
  });

  // 2. Check Budget Limits for current month
  const currentYearMonth = today.toISOString().substring(0, 7);
  const currentMonthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(currentYearMonth)
  );

  budgetLimits.forEach((limit) => {
    const categorySpent = currentMonthExpenses
      .filter((t) => t.category === limit.category)
      .reduce((sum, t) => sum + t.amount, 0);

    const percent = (categorySpent / limit.monthlyLimit) * 100;
    const threshold = limit.notifyAtPercent || 80;

    if (percent >= 100) {
      const notifKey = `budget-exceeded-${limit.category}-${currentYearMonth}`;
      const isRead = isMarkedRead(notifKey);
      const notif: AppNotification = {
        id: notifKey,
        title: `Przekroczono limit: ${limit.category}`,
        message: `${percent.toFixed(0)}% limitu`,
        type: 'budget_exceeded',
        date: new Date().toISOString(),
        read: isRead,
        relatedId: limit.category,
        targetTab: 'limits',
      };
      newNotifications.unshift(notif);
      if (!isRead) {
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    } else if (percent >= threshold) {
      const notifKey = `budget-warning-${limit.category}-${currentYearMonth}`;
      const isRead = isMarkedRead(notifKey);
      const notif: AppNotification = {
        id: notifKey,
        title: `Ostrzeżenie: ${limit.category}`,
        message: `${percent.toFixed(0)}% limitu`,
        type: 'budget_warning',
        date: new Date().toISOString(),
        read: isRead,
        relatedId: limit.category,
        targetTab: 'limits',
      };
      newNotifications.unshift(notif);
      if (!isRead) {
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    }
  });

  // Sort by date newest first
  newNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return newNotifications;
}
