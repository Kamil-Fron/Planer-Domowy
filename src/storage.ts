import {
  Transaction,
  ShoppingList,
  ShoppingItem,
  Bill,
  BudgetLimit,
  AppNotification,
  Household,
  UserProfile,
} from './types';
import {
  INITIAL_TRANSACTIONS,
  INITIAL_SHOPPING_LISTS,
  INITIAL_SHOPPING_ITEMS,
  INITIAL_BILLS,
  INITIAL_BUDGET_LIMITS,
} from './mockData';

const KEYS = {
  TRANSACTIONS: 'budget_planner_transactions_v1',
  SHOPPING_LISTS: 'budget_planner_shopping_lists_v1',
  SHOPPING_ITEMS: 'budget_planner_shopping_items_v1',
  BILLS: 'budget_planner_bills_v1',
  BUDGET_LIMITS: 'budget_planner_limits_v1',
  NOTIFICATIONS: 'budget_planner_notifications_v1',
  PUSH_ENABLED: 'budget_planner_push_enabled_v1',
  HOUSEHOLD: 'budget_planner_household_v1',
  USER_PROFILE: 'budget_planner_user_v1',
  SNAPSHOTS: 'budget_planner_snapshots_history_v1',
};

export interface DataSnapshot {
  id: string;
  timestamp: string;
  label: string;
  counts: {
    transactions: number;
    bills: number;
    budgetLimits: number;
    shoppingItems: number;
  };
  data: {
    transactions: Transaction[];
    bills: Bill[];
    budgetLimits: BudgetLimit[];
    shoppingLists: ShoppingList[];
    shoppingItems: ShoppingItem[];
  };
}

function getItemSafe<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Error reading from localStorage (${key}):`, err);
    return defaultValue;
  }
}

function setItemSafe<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing to localStorage (${key}):`, err);
  }
}

// Snapshot Backup Management
const MAX_SNAPSHOTS = 20;

export const loadBackupSnapshots = (): DataSnapshot[] => {
  return getItemSafe<DataSnapshot[]>(KEYS.SNAPSHOTS, []);
};

export const saveBackupSnapshot = (
  label: string,
  data: {
    transactions: Transaction[];
    bills: Bill[];
    budgetLimits: BudgetLimit[];
    shoppingLists: ShoppingList[];
    shoppingItems: ShoppingItem[];
  }
): void => {
  try {
    const existing = loadBackupSnapshots();
    const newSnapshot: DataSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      label,
      counts: {
        transactions: data.transactions?.length || 0,
        bills: data.bills?.length || 0,
        budgetLimits: data.budgetLimits?.length || 0,
        shoppingItems: data.shoppingItems?.length || 0,
      },
      data: {
        transactions: data.transactions || [],
        bills: data.bills || [],
        budgetLimits: data.budgetLimits || [],
        shoppingLists: data.shoppingLists || [],
        shoppingItems: data.shoppingItems || [],
      },
    };

    // Prepend new snapshot, limit to MAX_SNAPSHOTS
    const updated = [newSnapshot, ...existing.slice(0, MAX_SNAPSHOTS - 1)];
    setItemSafe(KEYS.SNAPSHOTS, updated);
  } catch (e) {
    console.warn('Nie udało się zapisać migawki lokalnej:', e);
  }
};

export const deleteBackupSnapshot = (snapshotId: string): void => {
  const existing = loadBackupSnapshots();
  const filtered = existing.filter((s) => s.id !== snapshotId);
  setItemSafe(KEYS.SNAPSHOTS, filtered);
};

export const clearAllBackupSnapshots = (): void => {
  try {
    localStorage.removeItem(KEYS.SNAPSHOTS);
  } catch (e) {
    console.warn('Nie udało się wyczyścić migawek:', e);
  }
};

// JSON File Export & Import
export const exportDataToJsonFile = (payload: {
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  householdName?: string;
}): void => {
  try {
    const exportObject = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'Planer Budżetu Domowego',
      householdName: payload.householdName || 'Mój Dom',
      ...payload,
    };
    const jsonStr = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `kopia-planer-budzetu-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Błąd eksportu kopii JSON:', e);
  }
};

export const scanLocalStorageForLostData = (): {
  recoveredTransactions: Transaction[];
  recoveredBills: Bill[];
  details: string[];
} => {
  const recoveredTransactions: Transaction[] = [];
  const recoveredBills: Bill[] = [];
  const details: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const val = localStorage.getItem(key);
        if (!val || val.length < 10) continue;

        const parsed = JSON.parse(val);

        // Check if snapshot array
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            // Check if transaction
            if (item && item.id && item.amount !== undefined && item.category && item.date && (item.type === 'income' || item.type === 'expense')) {
              recoveredTransactions.push(item);
            }
            // Check if snapshot containing transactions
            if (item && item.data && Array.isArray(item.data.transactions)) {
              item.data.transactions.forEach((tx: any) => {
                if (tx && tx.id && tx.amount) recoveredTransactions.push(tx);
              });
            }
            if (item && item.data && Array.isArray(item.data.bills)) {
              item.data.bills.forEach((b: any) => {
                if (b && b.id && b.name) recoveredBills.push(b);
              });
            }
            // Check if bill
            if (item && item.id && item.name && item.amount !== undefined && item.dueDate) {
              recoveredBills.push(item);
            }
          });
        }
      } catch {
        // Not JSON, ignore
      }
    }

    // Deduplicate by ID
    const uniqueTxMap = new Map<string, Transaction>();
    recoveredTransactions.forEach((t) => uniqueTxMap.set(t.id, t));
    const uniqueBillsMap = new Map<string, Bill>();
    recoveredBills.forEach((b) => uniqueBillsMap.set(b.id, b));

    return {
      recoveredTransactions: Array.from(uniqueTxMap.values()),
      recoveredBills: Array.from(uniqueBillsMap.values()),
      details,
    };
  } catch (e) {
    console.warn('Błąd skanera pamięci podręcznej:', e);
    return { recoveredTransactions: [], recoveredBills: [], details: [] };
  }
};

// Named export functions
export const loadTransactions = (): Transaction[] => getItemSafe(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
export const saveTransactions = (data: Transaction[]): void => setItemSafe(KEYS.TRANSACTIONS, data);

export const loadShoppingLists = (): ShoppingList[] => getItemSafe(KEYS.SHOPPING_LISTS, INITIAL_SHOPPING_LISTS);
export const saveShoppingLists = (data: ShoppingList[]): void => setItemSafe(KEYS.SHOPPING_LISTS, data);

export const loadShoppingItems = (): ShoppingItem[] => getItemSafe(KEYS.SHOPPING_ITEMS, INITIAL_SHOPPING_ITEMS);
export const saveShoppingItems = (data: ShoppingItem[]): void => setItemSafe(KEYS.SHOPPING_ITEMS, data);

export const loadBills = (): Bill[] => getItemSafe(KEYS.BILLS, INITIAL_BILLS);
export const saveBills = (data: Bill[]): void => setItemSafe(KEYS.BILLS, data);

export const loadBudgetLimits = (): BudgetLimit[] => getItemSafe(KEYS.BUDGET_LIMITS, INITIAL_BUDGET_LIMITS);
export const saveBudgetLimits = (data: BudgetLimit[]): void => setItemSafe(KEYS.BUDGET_LIMITS, data);

export const loadNotifications = (): AppNotification[] => getItemSafe(KEYS.NOTIFICATIONS, []);
export const saveNotifications = (data: AppNotification[]): void => setItemSafe(KEYS.NOTIFICATIONS, data);

export const loadPushSetting = (): boolean => getItemSafe(KEYS.PUSH_ENABLED, false);
export const savePushSetting = (enabled: boolean): void => setItemSafe(KEYS.PUSH_ENABLED, enabled);

export const DEFAULT_USER: UserProfile = {
  id: '',
  name: 'Gość',
  email: '',
  isLoggedIn: false,
};

export const loadHousehold = (): Household | null => getItemSafe<Household | null>(KEYS.HOUSEHOLD, null);
export const saveHousehold = (data: Household | null): void => setItemSafe(KEYS.HOUSEHOLD, data);

export const loadUserProfile = (): UserProfile => getItemSafe<UserProfile>(KEYS.USER_PROFILE, DEFAULT_USER);
export const saveUserProfile = (data: UserProfile): void => setItemSafe(KEYS.USER_PROFILE, data);

export const Storage = {
  getTransactions: loadTransactions,
  saveTransactions,
  getShoppingLists: loadShoppingLists,
  saveShoppingLists,
  getShoppingItems: loadShoppingItems,
  saveShoppingItems,
  getBills: loadBills,
  saveBills,
  getBudgetLimits: loadBudgetLimits,
  saveBudgetLimits,
  getNotifications: loadNotifications,
  saveNotifications,
  getPushEnabled: loadPushSetting,
  setPushEnabled: savePushSetting,
  resetAll(): void {
    localStorage.removeItem(KEYS.TRANSACTIONS);
    localStorage.removeItem(KEYS.SHOPPING_LISTS);
    localStorage.removeItem(KEYS.SHOPPING_ITEMS);
    localStorage.removeItem(KEYS.BILLS);
    localStorage.removeItem(KEYS.BUDGET_LIMITS);
    localStorage.removeItem(KEYS.NOTIFICATIONS);
    localStorage.removeItem(KEYS.PUSH_ENABLED);
  },
};
