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

export function sendBrowserPushNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
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

export function generateAutomatedNotifications(
  bills: Bill[],
  transactions: Transaction[],
  budgetLimits: BudgetLimit[],
  existingNotifications: AppNotification[]
): AppNotification[] {
  const newNotifications: AppNotification[] = [...existingNotifications];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Check Bills Due Dates
  bills.forEach((bill) => {
    if (bill.status === 'paid') return;

    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const billNotificationKey = `bill-${bill.id}-${bill.dueDate}-${diffDays <= 0 ? 'overdue' : 'due'}`;
    const alreadyExists = newNotifications.some((n) => n.id === billNotificationKey);

    if (!alreadyExists) {
      if (diffDays < 0) {
        // Overdue
        const notif: AppNotification = {
          id: billNotificationKey,
          title: `⚠️ Zaległy rachunek: ${bill.name}`,
          message: `Termin płatności minął ${Math.abs(diffDays)} dni temu (${bill.dueDate}). Kwota: ${bill.amount.toFixed(2)} PLN.`,
          type: 'bill_overdue',
          date: new Date().toISOString(),
          read: false,
          relatedId: bill.id,
        };
        newNotifications.unshift(notif);
        sendBrowserPushNotification(notif.title, { body: notif.message });
      } else if (diffDays === 0) {
        // Due today
        const notif: AppNotification = {
          id: billNotificationKey,
          title: `🔔 Dzisiaj termin płatności: ${bill.name}`,
          message: `Rachunek na kwotę ${bill.amount.toFixed(2)} PLN (${bill.provider}) przypada na dzisiaj!`,
          type: 'bill_due',
          date: new Date().toISOString(),
          read: false,
          relatedId: bill.id,
        };
        newNotifications.unshift(notif);
        sendBrowserPushNotification(notif.title, { body: notif.message });
      } else if (diffDays <= 3) {
        // Due in 1-3 days
        const notif: AppNotification = {
          id: billNotificationKey,
          title: `⏰ Zbliża się płatność: ${bill.name}`,
          message: `Za ${diffDays} dni mija termin płatności (${bill.dueDate}) na kwotę ${bill.amount.toFixed(2)} PLN.`,
          type: 'bill_due',
          date: new Date().toISOString(),
          read: false,
          relatedId: bill.id,
        };
        newNotifications.unshift(notif);
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
      if (!newNotifications.some((n) => n.id === notifKey)) {
        const notif: AppNotification = {
          id: notifKey,
          title: `🚨 Przekroczono budżet: ${limit.category}`,
          message: `Wydano ${categorySpent.toFixed(2)} PLN z limitu ${limit.monthlyLimit.toFixed(2)} PLN (${percent.toFixed(0)}%).`,
          type: 'budget_exceeded',
          date: new Date().toISOString(),
          read: false,
        };
        newNotifications.unshift(notif);
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    } else if (percent >= threshold) {
      const notifKey = `budget-warning-${limit.category}-${currentYearMonth}`;
      if (!newNotifications.some((n) => n.id === notifKey)) {
        const notif: AppNotification = {
          id: notifKey,
          title: `⚠️ Ostrzeżenie budżetowe: ${limit.category}`,
          message: `Wykorzystano już ${percent.toFixed(0)}% miesięcznego limitu (${categorySpent.toFixed(2)} / ${limit.monthlyLimit.toFixed(2)} PLN).`,
          type: 'budget_warning',
          date: new Date().toISOString(),
          read: false,
        };
        newNotifications.unshift(notif);
        sendBrowserPushNotification(notif.title, { body: notif.message });
      }
    }
  });

  return newNotifications.slice(0, 30); // Keep latest 30
}
