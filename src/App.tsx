import React, { useState, useEffect, useRef } from 'react';
import {
  TabType,
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
  Household,
  UserProfile,
} from './types';
import {
  loadTransactions,
  saveTransactions,
  loadBills,
  saveBills,
  loadBudgetLimits,
  saveBudgetLimits,
  loadShoppingLists,
  saveShoppingLists,
  loadShoppingItems,
  saveShoppingItems,
  loadPushSetting,
  savePushSetting,
  loadHousehold,
  saveHousehold,
  loadUserProfile,
  saveUserProfile,
} from './storage';
import {
  subscribeToFirebaseAuthState,
  subscribeToHouseholdFirestore,
  saveHouseholdToFirestore,
  isFirebaseConfigured,
} from './firebase';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TransactionsManager } from './components/TransactionsManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ShoppingLists } from './components/ShoppingLists';
import { BillsManager } from './components/BillsManager';
import { BudgetLimits } from './components/BudgetLimits';
import { ReportsView } from './components/ReportsView';
import { HouseholdModal } from './components/HouseholdModal';
import { checkAndTriggerBillNotifications } from './utils/notifications';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');

  // Core Data States loaded from Storage
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(loadBudgetLimits);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>(loadShoppingLists);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(loadShoppingItems);
  const [pushEnabled, setPushEnabled] = useState<boolean>(loadPushSetting);

  // Household & Auth States
  const [household, setHousehold] = useState<Household | null>(loadHousehold);
  const [currentUser, setCurrentUser] = useState<UserProfile>(loadUserProfile);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ref to prevent echo update loops when Firestore snapshot triggers local state update
  const isIncomingFirestoreUpdate = useRef(false);

  // 1. Subscribe to Firebase Auth state on mount
  useEffect(() => {
    const unsubAuth = subscribeToFirebaseAuthState((user) => {
      if (user) {
        setCurrentUser((prev) => ({
          ...prev,
          ...user,
          isLoggedIn: true,
        }));
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. Real-time sync with Cloud Firestore when household is present
  useEffect(() => {
    if (!household?.id || !isFirebaseConfigured()) return;

    const unsubscribe = subscribeToHouseholdFirestore(
      household.id,
      (cloudData) => {
        if (!cloudData) return;
        isIncomingFirestoreUpdate.current = true;

        if (cloudData.transactions && Array.isArray(cloudData.transactions)) {
          setTransactions(cloudData.transactions);
        }
        if (cloudData.bills && Array.isArray(cloudData.bills)) {
          setBills(cloudData.bills);
        }
        if (cloudData.budgetLimits && Array.isArray(cloudData.budgetLimits)) {
          setBudgetLimits(cloudData.budgetLimits);
        }
        if (cloudData.shoppingLists && Array.isArray(cloudData.shoppingLists)) {
          setShoppingLists(cloudData.shoppingLists);
        }
        if (cloudData.shoppingItems && Array.isArray(cloudData.shoppingItems)) {
          setShoppingItems(cloudData.shoppingItems);
        }
        if (cloudData.name || cloudData.members) {
          setHousehold((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              name: cloudData.name || prev.name,
              members: cloudData.members || prev.members,
              inviteCode: cloudData.inviteCode || prev.inviteCode,
              syncStatus: 'synced',
            };
          });
        }

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      },
      (err) => {
        console.warn('Firestore subscription status:', err);
      }
    );

    return () => unsubscribe();
  }, [household?.id]);

  // 3. Sync local changes back to Cloud Firestore
  useEffect(() => {
    if (!household?.id || !isFirebaseConfigured()) return;
    if (isIncomingFirestoreUpdate.current) return;

    const timer = setTimeout(() => {
      saveHouseholdToFirestore(household.id, {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        createdAt: household.createdAt,
        createdBy: household.createdBy,
        members: household.members,
        transactions,
        bills,
        budgetLimits,
        shoppingLists,
        shoppingItems,
        lastUpdatedBy: currentUser.email || currentUser.name,
      }).catch((e) => console.warn('Błąd autosave do Firestore:', e));
    }, 600);

    return () => clearTimeout(timer);
  }, [transactions, bills, budgetLimits, shoppingLists, shoppingItems, household, currentUser]);

  // Sync to local storage for offline responsiveness
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveBills(bills);
  }, [bills]);

  useEffect(() => {
    saveBudgetLimits(budgetLimits);
  }, [budgetLimits]);

  useEffect(() => {
    saveShoppingLists(shoppingLists);
  }, [shoppingLists]);

  useEffect(() => {
    saveShoppingItems(shoppingItems);
  }, [shoppingItems]);

  useEffect(() => {
    savePushSetting(pushEnabled);
  }, [pushEnabled]);

  useEffect(() => {
    saveHousehold(household);
  }, [household]);

  useEffect(() => {
    saveUserProfile(currentUser);
  }, [currentUser]);

  // Periodic and on-mount push notification check
  useEffect(() => {
    if (pushEnabled) {
      checkAndTriggerBillNotifications(bills);
    }
  }, [bills, pushEnabled]);

  // Transaction Handlers
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const tx: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Bill Handlers
  const handleAddBill = (newBill: Omit<Bill, 'id' | 'createdAt'>) => {
    const bill: Bill = {
      ...newBill,
      id: `bill-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setBills((prev) => [bill, ...prev]);
  };

  const handleUpdateBill = (id: string, updates: Partial<Bill>) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleDeleteBill = (id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  // Shopping List Handlers
  const handleAddShoppingList = (newList: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const list: ShoppingList = {
      ...newList,
      id: `list-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setShoppingLists((prev) => [...prev, list]);
  };

  const handleDeleteShoppingList = (id: string) => {
    setShoppingLists((prev) => prev.filter((l) => l.id !== id));
    setShoppingItems((prev) => prev.filter((i) => i.listId !== id));
  };

  // Shopping Item Handlers
  const handleAddShoppingItem = (newItem: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const item: ShoppingItem = {
      ...newItem,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    setShoppingItems((prev) => [...prev, item]);
  };

  const handleToggleShoppingItem = (id: string) => {
    setShoppingItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isCompleted: !i.isCompleted } : i))
    );
  };

  const handleDeleteShoppingItem = (id: string) => {
    setShoppingItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Budget Limit Handlers
  const handleUpdateBudgetLimit = (id: string, newLimit: number, threshold?: number) => {
    setBudgetLimits((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              monthlyLimit: newLimit,
              notifyAtPercent: threshold !== undefined ? threshold : l.notifyAtPercent,
            }
          : l
      )
    );
  };

  const handleAddBudgetLimit = (limit: Omit<BudgetLimit, 'id'>) => {
    const newLim: BudgetLimit = {
      ...limit,
      id: `lim-${Date.now()}`,
    };
    setBudgetLimits((prev) => [...prev, newLim]);
  };

  const handleDeleteBudgetLimit = (id: string) => {
    setBudgetLimits((prev) => prev.filter((l) => l.id !== id));
  };

  // Receipt Scanner Callback: add scanned receipt as transaction
  const handleScannedReceipt = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    handleAddTransaction(transaction);
    setActiveTab('transactions');
  };

  // Household & Auth Handlers
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (household) {
      const exists = household.members.some((m) => m.email === user.email || m.id === user.id);
      if (!exists && user.email) {
        setHousehold({
          ...household,
          members: [
            ...household.members,
            {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: 'member',
              joinedAt: new Date().toISOString(),
              isCurrentUser: true,
            },
          ],
        });
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser({
      id: 'guest',
      name: 'Gość',
      email: '',
      isLoggedIn: false,
    });
  };

  const handleCreateHousehold = (name: string) => {
    const newHousehold: Household = {
      id: `house-${Date.now()}`,
      name,
      inviteCode: `DOM-${Math.floor(1000 + Math.random() * 9000)}-PL`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      syncStatus: 'synced',
      cloudProvider: 'firebase',
      members: [
        {
          id: currentUser.id || `user-1`,
          email: currentUser.email || 'rodzina@gmail.com',
          name: currentUser.name || 'Właściciel',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          isCurrentUser: true,
        },
      ],
    };
    setHousehold(newHousehold);
    if (isFirebaseConfigured()) {
      saveHouseholdToFirestore(newHousehold.id, {
        ...newHousehold,
        transactions,
        bills,
        budgetLimits,
        shoppingLists,
        shoppingItems,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });
    }
  };

  const handleJoinHousehold = (code: string) => {
    const joinedHousehold: Household = {
      id: `house-code-${code.toLowerCase()}`,
      name: `Dom (${code})`,
      inviteCode: code,
      createdAt: new Date().toISOString(),
      createdBy: 'cloud',
      syncStatus: 'synced',
      cloudProvider: 'firebase',
      members: [
        {
          id: currentUser.id || `user-${Date.now()}`,
          email: currentUser.email || 'domownik@gmail.com',
          name: currentUser.name || 'Członek',
          role: 'member',
          joinedAt: new Date().toISOString(),
          isCurrentUser: true,
        },
      ],
    };
    setHousehold(joinedHousehold);
  };

  const handleInviteMember = (email: string, name: string) => {
    if (!household) return;
    const newMember = {
      id: `member-${Date.now()}`,
      email,
      name,
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    };
    const updated = {
      ...household,
      members: [...household.members, newMember],
    };
    setHousehold(updated);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!household) return;
    const updated = {
      ...household,
      members: household.members.filter((m) => m.id !== memberId),
    };
    setHousehold(updated);
  };

  const handleTriggerManualSync = async () => {
    if (!household?.id || !isFirebaseConfigured()) return;
    setIsSyncing(true);
    try {
      await saveHouseholdToFirestore(household.id, {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        createdAt: household.createdAt,
        createdBy: household.createdBy,
        members: household.members,
        transactions,
        bills,
        budgetLimits,
        shoppingLists,
        shoppingItems,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });
    } catch (e) {
      console.warn('Manual sync failed:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col antialiased selection:bg-indigo-600 selection:text-white font-sans">
      {/* Top Main Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        bills={bills}
        budgetLimits={budgetLimits}
        transactions={transactions}
        household={household}
        currentUser={currentUser}
        onOpenHouseholdModal={() => setIsHouseholdModalOpen(true)}
      />

      {/* Household & Family Cloud Sync Modal */}
      <HouseholdModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        currentUser={currentUser}
        household={household}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onCreateHousehold={handleCreateHousehold}
        onJoinHousehold={handleJoinHousehold}
        onInviteMember={handleInviteMember}
        onRemoveMember={handleRemoveMember}
        onTriggerSync={handleTriggerManualSync}
        isSyncing={isSyncing}
      />

      {/* Dynamic Views Viewport */}
      <main className="flex-1 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            bills={bills}
            budgetLimits={budgetLimits}
            shoppingLists={shoppingLists}
            shoppingItems={shoppingItems}
            selectedMonth={selectedMonth}
            onNavigate={setActiveTab}
            onQuickAddTransaction={(type) => {
              setActiveTab('transactions');
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsManager
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'scanner' && (
          <ReceiptScanner
            onReceiptScanned={handleScannedReceipt}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingLists
            shoppingLists={shoppingLists}
            shoppingItems={shoppingItems}
            onAddList={handleAddShoppingList}
            onDeleteList={handleDeleteShoppingList}
            onAddItem={handleAddShoppingItem}
            onToggleItem={handleToggleShoppingItem}
            onDeleteItem={handleDeleteShoppingItem}
            onAddTransaction={handleAddTransaction}
          />
        )}

        {activeTab === 'bills' && (
          <BillsManager
            bills={bills}
            onAddBill={handleAddBill}
            onUpdateBill={handleUpdateBill}
            onDeleteBill={handleDeleteBill}
            onAddTransaction={handleAddTransaction}
            pushEnabled={pushEnabled}
            onTogglePush={setPushEnabled}
          />
        )}

        {activeTab === 'limits' && (
          <BudgetLimits
            budgetLimits={budgetLimits}
            transactions={transactions}
            onUpdateLimit={handleUpdateBudgetLimit}
            onAddLimit={handleAddBudgetLimit}
            onDeleteLimit={handleDeleteBudgetLimit}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            transactions={transactions}
            bills={bills}
            budgetLimits={budgetLimits}
            selectedMonth={selectedMonth}
          />
        )}
      </main>
    </div>
  );
}
