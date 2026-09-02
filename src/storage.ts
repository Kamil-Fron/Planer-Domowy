import {
  Transaction,
  ShoppingList,
  ShoppingItem,
  Bill,
  BudgetLimit,
  AppNotification,
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
};

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

export const DEFAULT_USER = {
  id: 'user-default-1',
  name: 'Użytkownik',
  email: 'rodzina@gmail.com',
  isLoggedIn: true,
};

export const DEFAULT_HOUSEHOLD = {
  id: 'household-default-1',
  name: 'Nasz Dom',
  inviteCode: 'DOM-2026-PL',
  createdAt: new Date().toISOString(),
  createdBy: 'user-default-1',
  syncStatus: 'synced' as const,
  cloudProvider: 'firebase' as const,
  members: [
    {
      id: 'user-default-1',
      name: 'Użytkownik',
      email: 'rodzina@gmail.com',
      role: 'owner' as const,
      joinedAt: new Date().toISOString(),
      isCurrentUser: true,
    },
  ],
};

export const loadHousehold = () => getItemSafe(KEYS.HOUSEHOLD, DEFAULT_HOUSEHOLD);
export const saveHousehold = (data: any): void => setItemSafe(KEYS.HOUSEHOLD, data);

export const loadUserProfile = () => getItemSafe(KEYS.USER_PROFILE, DEFAULT_USER);
export const saveUserProfile = (data: any): void => setItemSafe(KEYS.USER_PROFILE, data);

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
