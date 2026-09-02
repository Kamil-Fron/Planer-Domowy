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
  getUserProfileFromFirestore,
  saveUserProfileToFirestore,
  getHouseholdFromFirestore,
  findHouseholdByInviteCode,
  logoutFromFirebase,
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

  // 1. Subscribe to Firebase Auth state on mount (ensures independent user isolation)
  useEffect(() => {
    const unsubAuth = subscribeToFirebaseAuthState(async (user) => {
      if (user) {
        setCurrentUser({
          ...user,
          isLoggedIn: true,
        });

        // Pobierz profil użytkownika z Firestore i załaduj jego aktywny dom
        if (isFirebaseConfigured()) {
          try {
            const profileData = await getUserProfileFromFirestore(user.id);
            if (profileData?.activeHouseholdId) {
              const cloudHousehold = await getHouseholdFromFirestore(profileData.activeHouseholdId);
              if (cloudHousehold) {
                setHousehold({
                  id: cloudHousehold.id,
                  name: cloudHousehold.name,
                  inviteCode: cloudHousehold.inviteCode,
                  createdAt: cloudHousehold.createdAt,
                  createdBy: cloudHousehold.createdBy,
                  members: cloudHousehold.members || [],
                  syncStatus: 'synced',
                  cloudProvider: 'firebase',
                });
                if (cloudHousehold.transactions && Array.isArray(cloudHousehold.transactions)) {
                  setTransactions(cloudHousehold.transactions);
                }
                if (cloudHousehold.bills && Array.isArray(cloudHousehold.bills)) {
                  setBills(cloudHousehold.bills);
                }
                if (cloudHousehold.budgetLimits && Array.isArray(cloudHousehold.budgetLimits)) {
                  setBudgetLimits(cloudHousehold.budgetLimits);
                }
                if (cloudHousehold.shoppingLists && Array.isArray(cloudHousehold.shoppingLists)) {
                  setShoppingLists(cloudHousehold.shoppingLists);
                }
                if (cloudHousehold.shoppingItems && Array.isArray(cloudHousehold.shoppingItems)) {
                  setShoppingItems(cloudHousehold.shoppingItems);
                }
              }
            } else {
              // Użytkownik nie ma jeszcze przypisanego żadnego domu - izolacja konta
              setHousehold(null);
            }
          } catch (e) {
            console.warn('Błąd pobierania powiązanego profilu/domu:', e);
          }
        }
      } else {
        setCurrentUser({
          id: '',
          name: 'Gość',
          email: '',
          isLoggedIn: false,
        });
        setHousehold(null);
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
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);

    if (isFirebaseConfigured()) {
      try {
        const profileData = await getUserProfileFromFirestore(user.id);
        if (profileData?.activeHouseholdId) {
          const cloudHousehold = await getHouseholdFromFirestore(profileData.activeHouseholdId);
          if (cloudHousehold) {
            setHousehold({
              id: cloudHousehold.id,
              name: cloudHousehold.name,
              inviteCode: cloudHousehold.inviteCode,
              createdAt: cloudHousehold.createdAt,
              createdBy: cloudHousehold.createdBy,
              members: cloudHousehold.members || [],
              syncStatus: 'synced',
              cloudProvider: 'firebase',
            });
            if (cloudHousehold.transactions) setTransactions(cloudHousehold.transactions);
            if (cloudHousehold.bills) setBills(cloudHousehold.bills);
            if (cloudHousehold.budgetLimits) setBudgetLimits(cloudHousehold.budgetLimits);
            if (cloudHousehold.shoppingLists) setShoppingLists(cloudHousehold.shoppingLists);
            if (cloudHousehold.shoppingItems) setShoppingItems(cloudHousehold.shoppingItems);
          }
        }
      } catch (e) {
        console.warn('Błąd po zalogowaniu:', e);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFromFirebase();
    } catch (e) {
      console.warn('Błąd podczas wylogowania:', e);
    }
    setCurrentUser({
      id: '',
      name: 'Gość',
      email: '',
      isLoggedIn: false,
    });
    setHousehold(null);
  };

  const handleCreateHousehold = async (name: string) => {
    const uniqueHouseId = `house-${currentUser.id || Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode = `DOM-${Math.floor(1000 + Math.random() * 9000)}-PL`;

    const newHousehold: Household = {
      id: uniqueHouseId,
      name,
      inviteCode,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id || 'owner',
      syncStatus: 'synced',
      cloudProvider: 'firebase',
      members: [
        {
          id: currentUser.id || `user-${Date.now()}`,
          email: currentUser.email || 'uzytkownik@gmail.com',
          name: currentUser.name || 'Właściciel',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          isCurrentUser: true,
        },
      ],
    };

    setHousehold(newHousehold);

    if (isFirebaseConfigured()) {
      await saveHouseholdToFirestore(newHousehold.id, {
        ...newHousehold,
        transactions,
        bills,
        budgetLimits,
        shoppingLists,
        shoppingItems,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });
      if (currentUser.id) {
        await saveUserProfileToFirestore(currentUser, newHousehold.id);
      }
    }
  };

  const handleJoinHousehold = async (code: string): Promise<{ success: boolean; message?: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Baza Firebase nie jest skonfigurowana. Wklej konfigurację w oknie domu.',
      };
    }

    try {
      const cloudHousehold = await findHouseholdByInviteCode(cleanCode);
      if (!cloudHousehold) {
        return {
          success: false,
          message: `Nie znaleziono gospodarstwa domowego o kodzie "${cleanCode}". Sprawdź, czy kod jest poprawny.`,
        };
      }

      // Sprawdź czy użytkownik jest już na liście członków
      const existingMembers = cloudHousehold.members || [];
      const alreadyMember = existingMembers.some(
        (m) => m.id === currentUser.id || (currentUser.email && m.email === currentUser.email)
      );

      const updatedMembers = alreadyMember
        ? existingMembers
        : [
            ...existingMembers,
            {
              id: currentUser.id || `user-${Date.now()}`,
              email: currentUser.email || '',
              name: currentUser.name || 'Domownik',
              role: 'member' as const,
              joinedAt: new Date().toISOString(),
            },
          ];

      const joinedHousehold: Household = {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        syncStatus: 'synced',
        cloudProvider: 'firebase',
        members: updatedMembers,
      };

      setHousehold(joinedHousehold);
      if (cloudHousehold.transactions) setTransactions(cloudHousehold.transactions);
      if (cloudHousehold.bills) setBills(cloudHousehold.bills);
      if (cloudHousehold.budgetLimits) setBudgetLimits(cloudHousehold.budgetLimits);
      if (cloudHousehold.shoppingLists) setShoppingLists(cloudHousehold.shoppingLists);
      if (cloudHousehold.shoppingItems) setShoppingItems(cloudHousehold.shoppingItems);

      // Zapisz w Firestore
      await saveHouseholdToFirestore(cloudHousehold.id, {
        members: updatedMembers,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });

      if (currentUser.id) {
        await saveUserProfileToFirestore(currentUser, cloudHousehold.id);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Błąd dołączania do domu:', err);
      return {
        success: false,
        message: err?.message || 'Wystąpił błąd podczas dołączania do gospodarstwa domowego.',
      };
    }
  };

  const handleLeaveHousehold = async () => {
    if (currentUser.id && isFirebaseConfigured()) {
      await saveUserProfileToFirestore(currentUser, '');
    }
    setHousehold(null);
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
      members: [...(household.members || []), newMember],
    };
    setHousehold(updated);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!household) return;
    const updated = {
      ...household,
      members: (household.members || []).filter((m) => m.id !== memberId),
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
        onLeaveHousehold={handleLeaveHousehold}
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
            onQuickAddTransaction={() => {
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
