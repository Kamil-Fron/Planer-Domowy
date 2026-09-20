import { AppNotification, Bill, BudgetLimit, TabType, Transaction } from '../types';

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

export interface NotificationNavTarget {
  tab: TabType;
  options?: {
    transactionFilter?: 'all' | 'income' | 'expense';
    transactionSearch?: string;
    selectedTxId?: string;
    payBillId?: string;
    billId?: string;
    openPayModal?: boolean;
    shoppingItemId?: string;
    shoppingCategory?: string;
    shoppingTab?: 'active' | 'completed';
    limitCategory?: string;
    debtId?: string;
  };
  openHouseholdModal?: boolean;
}

/**
 * Rozpoznaje i wyznacza precyzyjną zakładkę oraz parametry podświetlenia
 * dla dowolnego powiadomienia w aplikacji.
 */
export function resolveNotificationNavigation(notif: AppNotification): NotificationNavTarget {
  const notifType = notif.type || '';
  const notifTitle = (notif.title || '').toLowerCase();
  const notifMessage = (notif.message || '').toLowerCase();
  const relatedId = notif.relatedId || '';
  const notifId = notif.id || '';

  // 1. Gospodarstwo domowe i zaproszenia
  if (
    notifType === 'join_request' ||
    notifType === 'join_approved' ||
    notif.targetTab === ('household' as any) ||
    notifTitle.includes('dołączenie') ||
    notifTitle.includes('gospodarstw')
  ) {
    return {
      tab: 'dashboard',
      openHouseholdModal: true,
    };
  }

  // 2. Kredyty i zobowiązania (Debts)
  if (
    notif.targetTab === 'debts' ||
    notifType === ('debt' as any) ||
    relatedId.startsWith('debt-') ||
    notifTitle.includes('zobowiązani') ||
    notifTitle.includes('kredyt') ||
    notifTitle.includes('pożyczk')
  ) {
    return {
      tab: 'debts',
      options: {
        debtId: relatedId || undefined,
      },
    };
  }

  // 3. Rachunki (Bills)
  if (
    notif.targetTab === 'bills' ||
    notifType === 'bill_due' ||
    notifType === 'bill_overdue' ||
    notifType === 'bill_added' ||
    relatedId.startsWith('bill-') ||
    notifTitle.includes('rachun') ||
    notifTitle.includes('opłat')
  ) {
    // Czyste ID rachunku
    let cleanBillId = relatedId;
    if (!cleanBillId && notifId.startsWith('bill-')) {
      const parts = notifId.split('-');
      // format: bill-{billId}-{dueDate}-{status}
      if (parts.length >= 2) {
        cleanBillId = parts.slice(1, -2).join('-');
      }
    }
    return {
      tab: 'bills',
      options: {
        billId: cleanBillId || undefined,
        payBillId: cleanBillId || undefined,
        openPayModal: false,
      },
    };
  }

  // 4. Limity budżetowe (Limits)
  if (
    notif.targetTab === 'limits' ||
    notifType === 'budget_warning' ||
    notifType === 'budget_exceeded' ||
    notifId.startsWith('budget-') ||
    notifTitle.includes('limit')
  ) {
    let cleanCategory = relatedId;
    if (!cleanCategory || cleanCategory.startsWith('notif-')) {
      if (notifId.startsWith('budget-exceeded-')) {
        cleanCategory = notifId.replace(/^budget-exceeded-/, '').replace(/-\d{4}-\d{2}$/, '');
      } else if (notifId.startsWith('budget-warning-')) {
        cleanCategory = notifId.replace(/^budget-warning-/, '').replace(/-\d{4}-\d{2}$/, '');
      }
    }
    return {
      tab: 'limits',
      options: {
        limitCategory: cleanCategory || undefined,
      },
    };
  }

  // 5. Lista zakupów (Shopping)
  if (
    notif.targetTab === 'shopping' ||
    notifType === 'shopping_added' ||
    notifType === 'item_bought' ||
    relatedId.startsWith('shop-') ||
    relatedId.startsWith('item-') ||
    relatedId.startsWith('list-') ||
    notifTitle.startsWith('kupiono') ||
    notifTitle.includes('artykuł') ||
    notifTitle.includes('listy zakupów')
  ) {
    const isCompletedItem = notifType === 'item_bought' || notifTitle.startsWith('kupiono');
    const isList = relatedId.startsWith('list-');
    return {
      tab: 'shopping',
      options: {
        shoppingItemId: !isList ? relatedId || undefined : undefined,
        shoppingCategory: isList ? relatedId : undefined,
        shoppingTab: isCompletedItem ? 'completed' : 'active',
      },
    };
  }

  // 6. Transakcje (Transactions)
  if (
    notif.targetTab === 'transactions' ||
    notifType === 'transaction_added' ||
    relatedId.startsWith('tx-') ||
    notifTitle.includes('transakcj') ||
    notifTitle.includes('paragon') ||
    notifTitle.includes('wydatek') ||
    notifTitle.includes('wpłat')
  ) {
    return {
      tab: 'transactions',
      options: {
        selectedTxId: relatedId || undefined,
        transactionFilter: 'all',
      },
    };
  }

  // 7. Przywrócone wpisy (Item Restored)
  if (notifType === 'item_restored') {
    if (relatedId.startsWith('tx-')) {
      return { tab: 'transactions', options: { selectedTxId: relatedId, transactionFilter: 'all' } };
    }
    if (relatedId.startsWith('bill-')) {
      return { tab: 'bills', options: { billId: relatedId, payBillId: relatedId, openPayModal: false } };
    }
    if (relatedId.startsWith('shop-') || relatedId.startsWith('item-')) {
      return { tab: 'shopping', options: { shoppingItemId: relatedId, shoppingTab: 'active' } };
    }
    if (relatedId.startsWith('debt-')) {
      return { tab: 'debts', options: { debtId: relatedId } };
    }
    if (relatedId.startsWith('limit-')) {
      return { tab: 'limits', options: { limitCategory: relatedId } };
    }
  }

  // 8. Celowy targetTab
  if (notif.targetTab) {
    return { tab: notif.targetTab };
  }

  // 9. Fallback na słowa kluczowe w treści
  const combinedText = `${notifTitle} ${notifMessage}`;
  if (combinedText.includes('rachun') || combinedText.includes('opłat')) {
    return { tab: 'bills', options: { billId: relatedId || undefined, payBillId: relatedId || undefined } };
  }
  if (combinedText.includes('transakcj') || combinedText.includes('wydatek')) {
    return { tab: 'transactions', options: { selectedTxId: relatedId || undefined, transactionFilter: 'all' } };
  }
  if (combinedText.includes('zakup') || combinedText.includes('artykuł')) {
    return { tab: 'shopping', options: { shoppingItemId: relatedId || undefined } };
  }
  if (combinedText.includes('kredyt') || combinedText.includes('pożyczk')) {
    return { tab: 'debts', options: { debtId: relatedId || undefined } };
  }
  if (combinedText.includes('limit')) {
    return { tab: 'limits', options: { limitCategory: relatedId || undefined } };
  }

  return { tab: 'dashboard' };
}

