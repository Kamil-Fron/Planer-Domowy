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
import { DeleteDataModal, DeleteSelection } from './components/DeleteDataModal';
import { LoginScreen } from './components/LoginScreen';
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
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [householdModalTab, setHouseholdModalTab] = useState<'household' | 'firebase_config' | 'pwa' | 'delete_data'>('household');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
        if (cloudData.members && Array.isArray(cloudData.members)) {
          setHousehold((prev) => (prev ? { ...prev, members: cloudData.members } : null));
        }

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      },
      (error) => {
        console.warn('Firestore subscription status:', error.message);
      }
    );

    return () => unsubscribe();
  }, [household?.id]);

  // 3. Auto sync changes to Firestore (debounced)
  useEffect(() => {
    if (isIncomingFirestoreUpdate.current) return;
    if (!household?.id || !isFirebaseConfigured()) return;

    const timer = setTimeout(async () => {
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
      } catch (err) {
        console.warn('Błąd synchronizacji z Firestore:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [transactions, bills, budgetLimits, shoppingLists, shoppingItems, household?.id, currentUser]);

  // 4. Persistence to LocalStorage fallback
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

  // 5. Check background bill notifications
  useEffect(() => {
    if (bills.length > 0 && pushEnabled) {
      checkAndTriggerBillNotifications(bills);
    }
  }, [bills, pushEnabled]);

  // Handlers for Transactions
  const handleAddTransaction = (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...transactionData,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleScannedReceipt = (extracted: {
    title: string;
    amount: number;
    category: any;
    date: string;
    items?: { name: string; price: number; quantity: number }[];
  }) => {
    handleAddTransaction({
      title: extracted.title,
      amount: extracted.amount,
      type: 'expense',
      category: extracted.category,
      date: extracted.date,
      receiptItems: extracted.items?.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: extracted.category,
      })),
    });
    setActiveTab('transactions');
  };

  // Handlers for Shopping Lists & Items
  const handleAddShoppingList = (listData: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const newList: ShoppingList = {
      ...listData,
      id: `list-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setShoppingLists((prev) => [...prev, newList]);
  };

  const handleDeleteShoppingList = (id: string) => {
    setShoppingLists((prev) => prev.filter((l) => l.id !== id));
    setShoppingItems((prev) => prev.filter((i) => i.listId !== id));
  };

  const handleAddShoppingItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      assignedTo: itemData.assignedTo || currentUser.name || 'Wszyscy',
    };
    setShoppingItems((prev) => [...prev, newItem]);
  };

  const handleToggleShoppingItem = (id: string) => {
    setShoppingItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isCompleted: !item.isCompleted,
            }
          : item
      )
    );
  };

  const handleDeleteShoppingItem = (id: string) => {
    setShoppingItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Handlers for Bills
  const handleAddBill = (billData: Omit<Bill, 'id'>) => {
    const newBill: Bill = {
      ...billData,
      id: `bill-${Date.now()}`,
    };
    setBills((prev) => [...prev, newBill]);
  };

  const handleUpdateBill = (id: string, updates: Partial<Bill>) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleDeleteBill = (id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  // Handlers for Budget Limits
  const handleAddBudgetLimit = (limitData: Omit<BudgetLimit, 'id'>) => {
    const newLimit: BudgetLimit = {
      ...limitData,
      id: `limit-${Date.now()}`,
    };
    setBudgetLimits((prev) => [...prev, newLimit]);
  };

  const handleUpdateBudgetLimit = (id: string, limit: number) => {
    setBudgetLimits((prev) => prev.map((l) => (l.id === id ? { ...l, limit } : l)));
  };

  const handleDeleteBudgetLimit = (id: string) => {
    setBudgetLimits((prev) => prev.filter((l) => l.id !== id));
  };

  // Selective Data Deletion
  const handleDeleteSelectedData = async (selection: DeleteSelection) => {
    let newTransactions = transactions;
    let newBills = bills;
    let newLimits = budgetLimits;
    let newShoppingLists = shoppingLists;
    let newShoppingItems = shoppingItems;
    let newHousehold = household;

    if (selection.transactions) {
      newTransactions = [];
      setTransactions([]);
      saveTransactions([]);
    }

    if (selection.bills) {
      newBills = [];
      setBills([]);
      saveBills([]);
    }

    if (selection.budgetLimits) {
      newLimits = [];
      setBudgetLimits([]);
      saveBudgetLimits([]);
    }

    if (selection.shopping) {
      newShoppingLists = [];
      newShoppingItems = [];
      setShoppingLists([]);
      setShoppingItems([]);
      saveShoppingLists([]);
      saveShoppingItems([]);
    }

    if (selection.household) {
      newHousehold = null;
      setHousehold(null);
      saveHousehold(null);
      if (currentUser.id && isFirebaseConfigured()) {
        try {
          await saveUserProfileToFirestore(currentUser, '');
        } catch (e) {
          console.warn('Błąd odłączania domu w Firestore:', e);
        }
      }
    }

    // Synchronize to Firestore if connected to a household
    if (newHousehold?.id && isFirebaseConfigured()) {
      try {
        await saveHouseholdToFirestore(newHousehold.id, {
          id: newHousehold.id,
          name: newHousehold.name,
          inviteCode: newHousehold.inviteCode,
          createdAt: newHousehold.createdAt,
          createdBy: newHousehold.createdBy,
          members: newHousehold.members,
          transactions: newTransactions,
          bills: newBills,
          budgetLimits: newLimits,
          shoppingLists: newShoppingLists,
          shoppingItems: newShoppingItems,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.warn('Błąd synchronizacji po usunięciu danych:', err);
      }
    }
  };

  // Handlers for Household & Auth
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    setIsGuestMode(false);
    setIsHouseholdModalOpen(false);

    if (isFirebaseConfigured() && user.id) {
      try {
        const profile = await getUserProfileFromFirestore(user.id);
        if (profile?.activeHouseholdId) {
          const cloudH = await getHouseholdFromFirestore(profile.activeHouseholdId);
          if (cloudH) {
            setHousehold({
              id: cloudH.id,
              name: cloudH.name,
              inviteCode: cloudH.inviteCode,
              createdAt: cloudH.createdAt,
              createdBy: cloudH.createdBy,
              members: cloudH.members || [],
              syncStatus: 'synced',
              cloudProvider: 'firebase',
            });
            if (cloudH.transactions && Array.isArray(cloudH.transactions)) {
              setTransactions(cloudH.transactions);
            }
            if (cloudH.bills && Array.isArray(cloudH.bills)) {
              setBills(cloudH.bills);
            }
            if (cloudH.budgetLimits && Array.isArray(cloudH.budgetLimits)) {
              setBudgetLimits(cloudH.budgetLimits);
            }
            if (cloudH.shoppingLists && Array.isArray(cloudH.shoppingLists)) {
              setShoppingLists(cloudH.shoppingLists);
            }
            if (cloudH.shoppingItems && Array.isArray(cloudH.shoppingItems)) {
              setShoppingItems(cloudH.shoppingItems);
            }
          }
        }
      } catch (e) {
        console.warn('Błąd ładowania gospodarstwa po logowaniu:', e);
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser({
      id: '',
      name: 'Gość',
      email: '',
      isLoggedIn: false,
    });
    setHousehold(null);
    setIsGuestMode(false);
  };

  const handleCreateHousehold = async (name: string) => {
    const inviteCode = `DOM-${Math.floor(1000 + Math.random() * 9000)}-PL`;
    const newHousehold: Household = {
      id: `hh-${Date.now()}`,
      name,
      inviteCode,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id || 'local-user',
      members: [
        {
          id: currentUser.id || 'owner',
          email: currentUser.email || 'ja@dom.pl',
          name: currentUser.name || 'Właściciel',
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
      syncStatus: 'synced',
      cloudProvider: 'firebase',
    };

    setHousehold(newHousehold);

    if (isFirebaseConfigured()) {
      try {
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
      } catch (err) {
        console.warn('Nie udało się zapisać nowego domu do Firestore:', err);
      }
    }
  };

  const handleJoinHousehold = async (code: string) => {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Najpierw skonfiguruj Firebase w zakładce „Konfiguracja Firebase”, aby łączyć się z innymi domownikami.',
      };
    }

    try {
      const cloudHousehold = await findHouseholdByInviteCode(code);
      if (!cloudHousehold) {
        return {
          success: false,
          message: `Nie znaleziono gospodarstwa o kodzie: ${code}. Sprawdź czy kod jest poprawny.`,
        };
      }

      const existingMembers = cloudHousehold.members || [];
      const alreadyMember = existingMembers.some(
        (m: any) =>
          m.id === currentUser.id ||
          (currentUser.email && m.email === currentUser.email)
      );

      let updatedMembers = existingMembers;
      if (!alreadyMember) {
        const newMember = {
          id: currentUser.id || `member-${Date.now()}`,
          email: currentUser.email || 'domownik@dom.pl',
          name: currentUser.name || 'Domownik',
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
        };
        updatedMembers = [...existingMembers, newMember];
      }

      setHousehold({
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
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

      await saveHouseholdToFirestore(cloudHousehold.id, {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
        transactions: cloudHousehold.transactions || transactions,
        bills: cloudHousehold.bills || bills,
        budgetLimits: cloudHousehold.budgetLimits || budgetLimits,
        shoppingLists: cloudHousehold.shoppingLists || shoppingLists,
        shoppingItems: cloudHousehold.shoppingItems || shoppingItems,
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

  // IF NOT LOGGED IN AND NOT IN GUEST MODE: Show dedicated Login Screen directly
  if (!currentUser.isLoggedIn && !isGuestMode) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onContinueAsGuest={() => setIsGuestMode(true)}
          onOpenFirebaseConfig={() => {
            setHouseholdModalTab('firebase_config');
            setIsHouseholdModalOpen(true);
          }}
        />

        {/* Firebase Config Modal accessible from Login Screen */}
        <HouseholdModal
          isOpen={isHouseholdModalOpen}
          onClose={() => setIsHouseholdModalOpen(false)}
          currentUser={currentUser}
          household={household}
          initialTab={householdModalTab}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
          onCreateHousehold={handleCreateHousehold}
          onJoinHousehold={handleJoinHousehold}
          onLeaveHousehold={handleLeaveHousehold}
          onInviteMember={handleInviteMember}
          onRemoveMember={handleRemoveMember}
          onTriggerSync={handleTriggerManualSync}
          isSyncing={isSyncing}
          transactions={transactions}
          bills={bills}
          budgetLimits={budgetLimits}
          shoppingLists={shoppingLists}
          shoppingItems={shoppingItems}
          onDeleteSelectedData={handleDeleteSelectedData}
        />
      </>
    );
  }

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
        onOpenHouseholdModal={() => {
          setHouseholdModalTab('household');
          setIsHouseholdModalOpen(true);
        }}
        onOpenDeleteDataModal={() => setIsDeleteModalOpen(true)}
      />

      {/* Household & Family Cloud Sync / Settings Modal */}
      <HouseholdModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        currentUser={currentUser}
        household={household}
        initialTab={householdModalTab}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onCreateHousehold={handleCreateHousehold}
        onJoinHousehold={handleJoinHousehold}
        onLeaveHousehold={handleLeaveHousehold}
        onInviteMember={handleInviteMember}
        onRemoveMember={handleRemoveMember}
        onTriggerSync={handleTriggerManualSync}
        isSyncing={isSyncing}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        onDeleteSelectedData={handleDeleteSelectedData}
      />

      {/* Standalone Selective Delete Data Modal */}
      <DeleteDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        household={household}
        onConfirmDelete={handleDeleteSelectedData}
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
