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
  AppNotification,
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
  loadNotifications,
  saveNotifications,
  loadPushSetting,
  savePushSetting,
  loadHousehold,
  saveHousehold,
  loadUserProfile,
  saveUserProfile,
  saveBackupSnapshot,
  scanLocalStorageForLostData,
  clearAllBackupSnapshots,
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
  findHouseholdsByMemberEmail,
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
import { DataSafetyModal } from './components/DataSafetyModal';
import { LoginScreen } from './components/LoginScreen';
import {
  checkAndTriggerBillNotifications,
  createActivityNotification,
} from './utils/notifications';
import { calculatePreviousDueDate } from './utils/billCycle';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');

  // Core Data States loaded from Storage
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(loadBudgetLimits);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>(loadShoppingLists);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(loadShoppingItems);
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const [pushEnabled, setPushEnabled] = useState<boolean>(loadPushSetting);

  // Household & Auth States
  const [household, setHousehold] = useState<Household | null>(loadHousehold);
  const [currentUser, setCurrentUser] = useState<UserProfile>(loadUserProfile);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isDataSafetyModalOpen, setIsDataSafetyModalOpen] = useState(false);
  const [householdModalTab, setHouseholdModalTab] = useState<'household' | 'firebase_config' | 'pwa' | 'delete_data'>('household');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error' | 'offline'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date());
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Ref to prevent echo update loops when Firestore snapshot triggers local state update
  const isIncomingFirestoreUpdate = useRef(false);
  const lastLocalMutationTime = useRef<number>(0);
  const hasUnsavedLocalChanges = useRef<boolean>(false);

  // Ref always pointing to freshest data
  const stateRef = useRef({
    transactions,
    bills,
    budgetLimits,
    shoppingLists,
    shoppingItems,
    notifications,
    household,
    currentUser,
  });

  useEffect(() => {
    stateRef.current = {
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
      notifications,
      household,
      currentUser,
    };
  });

  // Helper to record new activity notification
  const logActivity = (title: string, message: string) => {
    const author = currentUser?.name || 'Domownik';
    const notif = createActivityNotification(title, message, author, 'activity');
    setNotifications((prev) => {
      const updated = [notif, ...prev.slice(0, 49)];
      saveNotifications(updated);
      return updated;
    });
  };

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
            let targetHouseholdId = profileData?.activeHouseholdId;

            // Jeśli profil nie ma aktywnego domu, sprawdź czy użytkownik nie został zaproszony przez email do istniejącego domu
            if (!targetHouseholdId && user.email) {
              const invitedHouseholds = await findHouseholdsByMemberEmail(user.email);
              if (invitedHouseholds.length > 0) {
                targetHouseholdId = invitedHouseholds[0].id;
                // Zaktualizuj activeHouseholdId w profilu
                await saveUserProfileToFirestore(user, targetHouseholdId);
              }
            }

            if (targetHouseholdId) {
              const cloudHousehold = await getHouseholdFromFirestore(targetHouseholdId);
              if (cloudHousehold) {
                // Zaktualizuj wpis członka o rzeczywiste dane zalogowanego użytkownika
                let updatedMembers = cloudHousehold.members || [];
                let memberChanged = false;
                const memberIndex = updatedMembers.findIndex(
                  (m) =>
                    m.id === user.id ||
                    (user.email && m.email && m.email.trim().toLowerCase() === user.email.trim().toLowerCase())
                );

                if (memberIndex >= 0) {
                  if (
                    updatedMembers[memberIndex].id !== user.id ||
                    updatedMembers[memberIndex].name !== user.name ||
                    updatedMembers[memberIndex].avatarUrl !== user.avatarUrl
                  ) {
                    updatedMembers[memberIndex] = {
                      ...updatedMembers[memberIndex],
                      id: user.id,
                      name: user.name || updatedMembers[memberIndex].name,
                      email: user.email || updatedMembers[memberIndex].email,
                      avatarUrl: user.avatarUrl || updatedMembers[memberIndex].avatarUrl,
                    };
                    memberChanged = true;
                  }
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

                // Directly assign cloud data as source of truth for logged in account
                const cloudTxs = cloudHousehold.transactions || [];
                const cloudBills = cloudHousehold.bills || [];
                const cloudLimits = cloudHousehold.budgetLimits || [];
                const cloudLists = cloudHousehold.shoppingLists || [];
                const cloudItems = cloudHousehold.shoppingItems || [];
                const cloudNotifs = cloudHousehold.notifications || [];

                setTransactions(cloudTxs);
                saveTransactions(cloudTxs);

                setBills(cloudBills);
                saveBills(cloudBills);

                setBudgetLimits(cloudLimits);
                saveBudgetLimits(cloudLimits);

                setShoppingLists(cloudLists);
                saveShoppingLists(cloudLists);

                setShoppingItems(cloudItems);
                saveShoppingItems(cloudItems);

                setNotifications(cloudNotifs);
                saveNotifications(cloudNotifs);

                setSyncStatus('synced');
                setLastSyncedAt(new Date());
                hasUnsavedLocalChanges.current = false;

                if (memberChanged) {
                  await saveHouseholdToFirestore(cloudHousehold.id, {
                    ...cloudHousehold,
                    members: updatedMembers,
                  });
                }
              }
            } else {
              // Użytkownik nie ma jeszcze przypisanego żadnego domu - wyczyść stale dane z innego konta
              setHousehold(null);
              setTransactions([]);
              saveTransactions([]);
              setBills([]);
              saveBills([]);
              setBudgetLimits([]);
              saveBudgetLimits([]);
              setShoppingLists([]);
              saveShoppingLists([]);
              setShoppingItems([]);
              saveShoppingItems([]);
              setNotifications([]);
              saveNotifications([]);
              hasUnsavedLocalChanges.current = false;
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
        hasUnsavedLocalChanges.current = false;
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Real-time sync with Cloud Firestore when household is present
  useEffect(() => {
    if (!household?.id || !isFirebaseConfigured()) return;

    const unsubscribe = subscribeToHouseholdFirestore(
      household.id,
      (cloudData, hasPendingWrites) => {
        if (!cloudData) return;
        // Don't overwrite if the user is in the middle of active local typing/mutation
        if (hasUnsavedLocalChanges.current && hasPendingWrites) return;

        isIncomingFirestoreUpdate.current = true;
        hasUnsavedLocalChanges.current = false;

        const cloudTxs = cloudData.transactions || [];
        const cloudBills = cloudData.bills || [];
        const cloudLimits = cloudData.budgetLimits || [];
        const cloudLists = cloudData.shoppingLists || [];
        const cloudItems = cloudData.shoppingItems || [];
        const cloudNotifs = cloudData.notifications || [];

        setTransactions(cloudTxs);
        saveTransactions(cloudTxs);

        setBills(cloudBills);
        saveBills(cloudBills);

        setBudgetLimits(cloudLimits);
        saveBudgetLimits(cloudLimits);

        setShoppingLists(cloudLists);
        saveShoppingLists(cloudLists);

        setShoppingItems(cloudItems);
        saveShoppingItems(cloudItems);

        setNotifications(cloudNotifs);
        saveNotifications(cloudNotifs);

        if (cloudData.members && Array.isArray(cloudData.members)) {
          setHousehold((prev) =>
            prev
              ? {
                  ...prev,
                  name: cloudData.name || prev.name,
                  members: cloudData.members,
                  inviteCode: cloudData.inviteCode || prev.inviteCode,
                }
              : null
          );
        }

        setSyncStatus('synced');
        setLastSyncedAt(new Date());

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      },
      (error) => {
        console.warn('Firestore subscription status:', error?.message);
        setSyncStatus('error');
        setSyncErrorMessage(error?.message || 'Błąd subskrypcji Firestore');
      }
    );

    return () => unsubscribe();
  }, [household?.id]);

  // 3. Auto sync changes to Firestore (debounced)
  useEffect(() => {
    if (isIncomingFirestoreUpdate.current) return;
    if (!hasUnsavedLocalChanges.current) return;
    if (!household?.id || !isFirebaseConfigured()) return;

    const timer = setTimeout(async () => {
      // Guard against race conditions
      if (isIncomingFirestoreUpdate.current || !hasUnsavedLocalChanges.current) return;

      setIsSyncing(true);
      setSyncStatus('saving');
      try {
        const current = stateRef.current;
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        setSyncErrorMessage(null);
      } catch (err: any) {
        console.warn('Błąd synchronizacji z Firestore:', err);
        setSyncStatus('error');
        setSyncErrorMessage(err?.message || 'Błąd zapisu do Firestore');
      } finally {
        setIsSyncing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [transactions, bills, budgetLimits, shoppingLists, shoppingItems, notifications, household?.id, currentUser]);

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
    saveNotifications(notifications);
  }, [notifications]);

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
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      saveTransactions(updated);
      return updated;
    });

    // Powiadomienie o nowej transakcji
    const typeLabel = transactionData.type === 'income' ? 'Wpłata' : 'Wydatek';
    logActivity(
      `Nowa transakcja: ${typeLabel}`,
      `${transactionData.title} (${transactionData.amount.toFixed(2)} PLN)`
    );
  };

  const handleDeleteTransaction = (id: string) => {
    const deletedTx = transactions.find((t) => t.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTransactions(updated);
      return updated;
    });
    if (deletedTx) {
      logActivity(
        'Usunięto transakcję',
        `Usunięto "${deletedTx.title}" (${deletedTx.amount.toFixed(2)} PLN)`
      );

      // Jeśli usunięta transakcja była powiązana z opłaconym rachunkiem,
      // usuń transakcję z historii uregulowanych cykli rachunku i przywróć do oczekujących
      const targetBillId = deletedTx.billId;
      const cleanTitleName = deletedTx.title.replace(/^Rachunek:\s*/i, '').trim().toLowerCase();

      setBills((prevBills) => {
        let billModified = false;
        const updatedBills = prevBills.map((b) => {
          const isDirectMatch = !!(targetBillId && b.id === targetBillId);
          const isNameMatch =
            !targetBillId &&
            deletedTx.category === 'Rachunki i media' &&
            (b.name.toLowerCase() === cleanTitleName ||
              (deletedTx.comment && deletedTx.comment.toLowerCase().includes(b.name.toLowerCase())));

          if (isDirectMatch || isNameMatch) {
            billModified = true;
            const history = b.paymentHistory || [];
            let removedItemIndex = -1;

            // 1. Dopasowanie po dacie transakcji i kwocie
            removedItemIndex = history.findIndex(
              (h) =>
                (h.paidDate === deletedTx.date || h.paidDate.slice(0, 7) === deletedTx.date.slice(0, 7)) &&
                Math.abs(h.amount - deletedTx.amount) < 0.05
            );

            // 2. Jeśli nie znaleziono, dopasowanie po miesiącu
            if (removedItemIndex === -1) {
              removedItemIndex = history.findIndex(
                (h) => h.paidDate.slice(0, 7) === deletedTx.date.slice(0, 7)
              );
            }

            // 3. Jeśli nie znaleziono, dopasowanie po kwocie
            if (removedItemIndex === -1) {
              removedItemIndex = history.findIndex(
                (h) => Math.abs(h.amount - deletedTx.amount) < 0.05
              );
            }

            // 4. Fallback: najnowszy wpis historii
            if (removedItemIndex === -1 && history.length > 0) {
              removedItemIndex = 0;
            }

            const updatedHistory =
              removedItemIndex !== -1
                ? history.filter((_, idx) => idx !== removedItemIndex)
                : history;

            // Przywróć poprzedni termin (np. wrzesień z października)
            const restoredDueDate =
              b.previousDueDate || calculatePreviousDueDate(b.dueDate, b.billingCycle);

            return {
              ...b,
              status: 'pending' as const,
              dueDate: restoredDueDate,
              previousDueDate: undefined,
              paymentDate: undefined,
              paymentHistory: updatedHistory,
              lastPaidAmount: updatedHistory[0]?.amount,
            };
          }
          return b;
        });

        if (billModified) {
          saveBills(updatedBills);
          logActivity(
            'Przywrócono rachunek do opłacenia',
            `Po usunięciu transakcji powiązany rachunek powrócił do statusu "Do zapłaty", a wpis usunięto z historii cykli`
          );
          return updatedBills;
        }
        return prevBills;
      });
    }
  };

  const handleUpdateTransaction = (id: string, updates: Partial<Transaction>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    let updatedTitle = '';
    setTransactions((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          updatedTitle = updates.title || t.title;
          return { ...t, ...updates };
        }
        return t;
      });
      saveTransactions(updated);
      return updated;
    });
    logActivity(
      'Zaktualizowano transakcję',
      `Zmieniono szczegóły transakcji "${updatedTitle || 'transakcja'}"`
    );
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
    logActivity('Zeskanowano paragon', `Wczytano paragon "${extracted.title}" na kwotę ${extracted.amount.toFixed(2)} PLN`);
    setActiveTab('transactions');
  };

  // Handlers for Shopping Lists & Items
  const handleAddShoppingList = (listData: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const newList: ShoppingList = {
      ...listData,
      id: `list-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingLists((prev) => {
      const updated = [...prev, newList];
      saveShoppingLists(updated);
      return updated;
    });
    logActivity('Nowa lista zakupów', `Utworzono listę: "${newList.name}"`);
  };

  const handleDeleteShoppingList = (id: string) => {
    const listToDelete = shoppingLists.find((l) => l.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingLists((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveShoppingLists(updated);
      return updated;
    });
    setShoppingItems((prev) => {
      const updated = prev.filter((i) => i.listId !== id);
      saveShoppingItems(updated);
      return updated;
    });
    if (listToDelete) {
      logActivity('Usunięto listę zakupów', `Skasowano listę "${listToDelete.name}"`);
    }
  };

  const handleAddShoppingItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      assignedTo: itemData.assignedTo || currentUser.name || 'Wszyscy',
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = [...prev, newItem];
      saveShoppingItems(updated);
      return updated;
    });
    logActivity('Dodano produkt do listy', `Dodano "${newItem.name}" (${newItem.quantity} ${newItem.unit})`);
  };

  const handleToggleShoppingItem = (id: string) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const isCompleted = !item.isCompleted;
          if (isCompleted) {
            logActivity('Kupiono produkt', `Kupiono "${item.name}"`);
          }
          return {
            ...item,
            isCompleted,
          };
        }
        return item;
      });
      saveShoppingItems(updated);
      return updated;
    });
  };

  const handleDeleteShoppingItem = (id: string) => {
    const itemToDelete = shoppingItems.find((i) => i.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveShoppingItems(updated);
      return updated;
    });
    if (itemToDelete) {
      logActivity('Usunięto z listy', `Usunięto artykuł "${itemToDelete.name}"`);
    }
  };

  const handleUpdateShoppingItem = (id: string, updates: Partial<ShoppingItem>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setShoppingItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      saveShoppingItems(updated);
      return updated;
    });
  };

  // Handlers for Bills
  const handleAddBill = (billData: Omit<Bill, 'id' | 'createdAt'> & { id?: string }) => {
    const newBill: Bill = {
      ...billData,
      id: billData.id || `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = [...prev, newBill];
      saveBills(updated);
      return updated;
    });
    logActivity(
      'Dodano nowy rachunek',
      `Rachunek: ${newBill.name} (${newBill.amount.toFixed(2)} PLN, termin: ${newBill.dueDate})`
    );
  };

  const handleUpdateBill = (id: string, updates: Partial<Bill>) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = prev.map((b) => {
        if (b.id === id) {
          const u = { ...b, ...updates };
          if (updates.status === 'paid' && b.status !== 'paid') {
            logActivity('Opłacono rachunek', `Rachunek "${b.name}" (${b.amount.toFixed(2)} PLN) został oznaczony jako opłacony!`);
          } else if (updates.amount !== undefined && updates.amount !== b.amount) {
            logActivity('Zaktualizowano rachunek', `Zmieniono kwotę rachunku "${b.name}" na ${updates.amount.toFixed(2)} PLN`);
          }
          return u;
        }
        return b;
      });
      saveBills(updated);
      return updated;
    });
  };

  const handleDeleteBill = (id: string) => {
    const billToDelete = bills.find((b) => b.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBills((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveBills(updated);
      return updated;
    });
    if (billToDelete) {
      logActivity('Usunięto rachunek', `Usunięto rachunek "${billToDelete.name}"`);
    }
  };

  // Handlers for Budget Limits
  const handleAddBudgetLimit = (limitData: Omit<BudgetLimit, 'id'>) => {
    const newLimit: BudgetLimit = {
      ...limitData,
      id: `limit-${Date.now()}`,
    };
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = [...prev, newLimit];
      saveBudgetLimits(updated);
      return updated;
    });
    logActivity('Ustalono limit budżetowy', `Limit dla ${newLimit.category}: ${newLimit.monthlyLimit.toFixed(2)} PLN`);
  };

  const handleUpdateBudgetLimit = (id: string, limit: number) => {
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = prev.map((l) => {
        if (l.id === id) {
          logActivity('Zmieniono limit budżetowy', `Nowy limit dla ${l.category}: ${limit.toFixed(2)} PLN`);
          return { ...l, monthlyLimit: limit };
        }
        return l;
      });
      saveBudgetLimits(updated);
      return updated;
    });
  };

  const handleDeleteBudgetLimit = (id: string) => {
    const limitToDelete = budgetLimits.find((l) => l.id === id);
    lastLocalMutationTime.current = Date.now();
    hasUnsavedLocalChanges.current = true;
    setBudgetLimits((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveBudgetLimits(updated);
      return updated;
    });
    if (limitToDelete) {
      logActivity('Usunięto limit budżetowy', `Skasowano limit dla ${limitToDelete.category}`);
    }
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
      clearAllBackupSnapshots();
    }

    if (selection.bills) {
      newBills = [];
      setBills([]);
      saveBills([]);
      clearAllBackupSnapshots();
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
          notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
      } catch (err) {
        console.warn('Błąd aktualizacji Firestore po usunięciu danych:', err);
      }
    }
  };

  // User Profile & Household Handlers
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    saveUserProfile(user);

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
            const cloudTxs = cloudH.transactions || [];
            const cloudBills = cloudH.bills || [];
            const cloudLimits = cloudH.budgetLimits || [];
            const cloudLists = cloudH.shoppingLists || [];
            const cloudItems = cloudH.shoppingItems || [];
            const cloudNotifs = cloudH.notifications || [];

            setTransactions(cloudTxs);
            saveTransactions(cloudTxs);

            setBills(cloudBills);
            saveBills(cloudBills);

            setBudgetLimits(cloudLimits);
            saveBudgetLimits(cloudLimits);

            setShoppingLists(cloudLists);
            saveShoppingLists(cloudLists);

            setShoppingItems(cloudItems);
            saveShoppingItems(cloudItems);

            setNotifications(cloudNotifs);
            saveNotifications(cloudNotifs);

            hasUnsavedLocalChanges.current = false;
          }
        }
      } catch (err) {
        console.warn('Błąd ładowania danych po logowaniu:', err);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFromFirebase();
    } catch (e) {
      console.warn('Logout warning:', e);
    }
    setCurrentUser({
      id: '',
      name: 'Gość',
      email: '',
      isLoggedIn: false,
    });
    setHousehold(null);
    setIsGuestMode(false);

    // Reset local data to isolate accounts completely
    setTransactions([]);
    saveTransactions([]);
    setBills([]);
    saveBills([]);
    setBudgetLimits([]);
    saveBudgetLimits([]);
    setShoppingLists([]);
    saveShoppingLists([]);
    setShoppingItems([]);
    saveShoppingItems([]);
    setNotifications([]);
    saveNotifications([]);
    hasUnsavedLocalChanges.current = false;
  };

  const handleCreateHousehold = async (name: string) => {
    const inviteCode = `DOM-${Math.floor(1000 + Math.random() * 9000)}-PL`;
    const newHouseholdObj: Household = {
      id: `hh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      inviteCode,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email || currentUser.name || 'Właściciel',
      members: [
        {
          id: currentUser.id || `member-${Date.now()}`,
          email: currentUser.email || 'gospodarz@dom.pl',
          name: currentUser.name || 'Gospodarz',
          avatarUrl: currentUser.avatarUrl,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      ],
      syncStatus: isFirebaseConfigured() ? 'synced' : 'offline',
      cloudProvider: 'firebase',
    };

    setHousehold(newHouseholdObj);
    hasUnsavedLocalChanges.current = true;
    logActivity('Utworzono gospodarstwo domowe', `Utworzono dom „${name}” z kodem zaproszenia ${inviteCode}`);

    if (isFirebaseConfigured()) {
      try {
        await saveHouseholdToFirestore(newHouseholdObj.id, {
          id: newHouseholdObj.id,
          name: newHouseholdObj.name,
          inviteCode: newHouseholdObj.inviteCode,
          createdAt: newHouseholdObj.createdAt,
          createdBy: newHouseholdObj.createdBy,
          members: newHouseholdObj.members,
          transactions,
          bills,
          budgetLimits,
          shoppingLists,
          shoppingItems,
          notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;

        if (currentUser.id) {
          await saveUserProfileToFirestore(currentUser, newHouseholdObj.id);
        }
      } catch (e) {
        console.error('Błąd zapisu nowego gospodarstwa w Firestore:', e);
      }
    }
  };

  const handleJoinHousehold = async (code: string): Promise<{ success: boolean; message?: string }> => {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        message: 'Aby dołączyć do domu przez kod, skonfiguruj najpierw połączenie z Firebase w zakładce [Konfiguracja].',
      };
    }

    try {
      const cleanCode = code.trim().toUpperCase();
      const cloudHousehold = await findHouseholdByInviteCode(cleanCode);
      if (!cloudHousehold) {
        return {
          success: false,
          message: `Nie znaleziono gospodarstwa o kodzie: ${cleanCode}. Upewnij się, że kod został podany bezbłędnie (np. ${cleanCode}).`,
        };
      }

      const existingMembers = cloudHousehold.members || [];
      const myEmail = (currentUser.email || '').trim().toLowerCase();
      const myId = currentUser.id;

      // Sprawdź czy użytkownik jest już na liście członków (po ID lub emailu)
      const existingIndex = existingMembers.findIndex(
        (m: any) =>
          (myId && m.id === myId) ||
          (myEmail && m.email && m.email.trim().toLowerCase() === myEmail)
      );

      let updatedMembers = [...existingMembers];
      if (existingIndex >= 0) {
        updatedMembers[existingIndex] = {
          ...updatedMembers[existingIndex],
          id: myId || updatedMembers[existingIndex].id,
          name: currentUser.name || updatedMembers[existingIndex].name,
          email: currentUser.email || updatedMembers[existingIndex].email,
          avatarUrl: currentUser.avatarUrl || updatedMembers[existingIndex].avatarUrl,
        };
      } else {
        const newMember = {
          id: myId || `member-${Date.now()}`,
          email: currentUser.email || 'domownik@dom.pl',
          name: currentUser.name || 'Domownik',
          avatarUrl: currentUser.avatarUrl,
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
        };
        updatedMembers.push(newMember);
      }

      const joinNotif = createActivityNotification(
        'Nowy domownik',
        `${currentUser.name || 'Nowy użytkownik'} dołączył(a) do wspólnego gospodarstwa domowego`,
        currentUser.name || 'Domownik',
        'activity'
      );

      const combinedNotifications = [
        joinNotif,
        ...(cloudHousehold.notifications || []),
      ].slice(0, 50);

      const joinedHousehold: Household = {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
        syncStatus: 'synced',
        cloudProvider: 'firebase',
      };

      setHousehold(joinedHousehold);
      saveHousehold(joinedHousehold);

      const cloudTxs = cloudHousehold.transactions || [];
      const cloudBills = cloudHousehold.bills || [];
      const cloudLimits = cloudHousehold.budgetLimits || [];
      const cloudLists = cloudHousehold.shoppingLists || [];
      const cloudItems = cloudHousehold.shoppingItems || [];

      setTransactions(cloudTxs);
      saveTransactions(cloudTxs);

      setBills(cloudBills);
      saveBills(cloudBills);

      setBudgetLimits(cloudLimits);
      saveBudgetLimits(cloudLimits);

      setShoppingLists(cloudLists);
      saveShoppingLists(cloudLists);

      setShoppingItems(cloudItems);
      saveShoppingItems(cloudItems);

      setNotifications(combinedNotifications);
      saveNotifications(combinedNotifications);

      await saveHouseholdToFirestore(cloudHousehold.id, {
        id: cloudHousehold.id,
        name: cloudHousehold.name,
        inviteCode: cloudHousehold.inviteCode,
        createdAt: cloudHousehold.createdAt,
        createdBy: cloudHousehold.createdBy,
        members: updatedMembers,
        transactions: cloudTxs,
        bills: cloudBills,
        budgetLimits: cloudLimits,
        shoppingLists: cloudLists,
        shoppingItems: cloudItems,
        notifications: combinedNotifications,
        lastUpdatedBy: currentUser.email || currentUser.name,
      });

      hasUnsavedLocalChanges.current = false;

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
    saveHousehold(null);
  };

  const handleInviteMember = async (email: string, name: string) => {
    if (!household) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    // Sprawdź czy już nie jest zaproszony
    const alreadyExists = (household.members || []).some(
      (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
    );
    if (alreadyExists) return;

    const newMember = {
      id: `invited-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      name: cleanName,
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    };

    const updatedMembers = [...(household.members || []), newMember];
    const inviteNotif = createActivityNotification(
      'Zaproszono domownika',
      `Wysłano zaproszenie dla ${cleanName} (${cleanEmail}) do wspólnego gospodarstwa`,
      currentUser.name || 'Gospodarz',
      'activity'
    );
    const updatedNotifs = [inviteNotif, ...notifications].slice(0, 50);

    const updated = {
      ...household,
      members: updatedMembers,
    };
    setHousehold(updated);
    setNotifications(updatedNotifs);

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...household,
          members: updatedMembers,
          notifications: updatedNotifs,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.error('Błąd zapisu zaproszonego członka do Firestore:', err);
      }
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!household) return;
    const removedMember = (household.members || []).find((m) => m.id === memberId);
    const updatedMembers = (household.members || []).filter((m) => m.id !== memberId);
    const updated = {
      ...household,
      members: updatedMembers,
    };
    setHousehold(updated);

    if (removedMember) {
      logActivity('Usunięto domownika', `Usunięto ${removedMember.name} z gospodarstwa domowego`);
    }

    if (isFirebaseConfigured() && household.id) {
      try {
        await saveHouseholdToFirestore(household.id, {
          ...household,
          members: updatedMembers,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      } catch (err) {
        console.error('Błąd usunięcia członka z Firestore:', err);
      }
    }
  };

  const handleForceSync = async (): Promise<boolean> => {
    if (!household?.id || !isFirebaseConfigured()) {
      setSyncErrorMessage('Brak aktywnego gospodarstwa domowego lub konfiguracji Firebase.');
      return false;
    }
    setIsSyncing(true);
    setSyncStatus('saving');
    try {
      const current = stateRef.current;

      // 1. If this client has unsaved local edits, push them to Firestore first
      if (hasUnsavedLocalChanges.current) {
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
        hasUnsavedLocalChanges.current = false;
      }

      // 2. Fetch the latest canonical data directly from Cloud Firestore
      const cloudHousehold = await getHouseholdFromFirestore(household.id);
      if (cloudHousehold) {
        isIncomingFirestoreUpdate.current = true;
        hasUnsavedLocalChanges.current = false;

        const cloudTxs = cloudHousehold.transactions || [];
        const cloudBills = cloudHousehold.bills || [];
        const cloudLimits = cloudHousehold.budgetLimits || [];
        const cloudLists = cloudHousehold.shoppingLists || [];
        const cloudItems = cloudHousehold.shoppingItems || [];
        const cloudNotifs = cloudHousehold.notifications || [];

        setTransactions(cloudTxs);
        saveTransactions(cloudTxs);

        setBills(cloudBills);
        saveBills(cloudBills);

        setBudgetLimits(cloudLimits);
        saveBudgetLimits(cloudLimits);

        setShoppingLists(cloudLists);
        saveShoppingLists(cloudLists);

        setShoppingItems(cloudItems);
        saveShoppingItems(cloudItems);

        setNotifications(cloudNotifs);
        saveNotifications(cloudNotifs);

        if (cloudHousehold.members && Array.isArray(cloudHousehold.members)) {
          setHousehold((prev) =>
            prev
              ? {
                  ...prev,
                  name: cloudHousehold.name || prev.name,
                  members: cloudHousehold.members,
                  inviteCode: cloudHousehold.inviteCode || prev.inviteCode,
                }
              : null
          );
        }

        setTimeout(() => {
          isIncomingFirestoreUpdate.current = false;
        }, 300);
      } else {
        // Document didn't exist yet in Firestore - initialize it with current state
        await saveHouseholdToFirestore(household.id, {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          createdBy: household.createdBy,
          members: household.members,
          transactions: current.transactions,
          bills: current.bills,
          budgetLimits: current.budgetLimits,
          shoppingLists: current.shoppingLists,
          shoppingItems: current.shoppingItems,
          notifications: current.notifications,
          lastUpdatedBy: currentUser.email || currentUser.name,
        });
      }

      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncErrorMessage(null);
      return true;
    } catch (e: any) {
      console.warn('Manual sync failed:', e);
      setSyncStatus('error');
      setSyncErrorMessage(e?.message || 'Błąd synchronizacji z bazą Firestore');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerManualSync = async () => {
    await handleForceSync();
  };

  const handleRestoreData = (data: {
    transactions?: Transaction[];
    bills?: Bill[];
    budgetLimits?: BudgetLimit[];
    shoppingLists?: ShoppingList[];
    shoppingItems?: ShoppingItem[];
  }) => {
    lastLocalMutationTime.current = Date.now();
    if (data.transactions) {
      setTransactions(data.transactions);
      saveTransactions(data.transactions);
    }
    if (data.bills) {
      setBills(data.bills);
      saveBills(data.bills);
    }
    if (data.budgetLimits) {
      setBudgetLimits(data.budgetLimits);
      saveBudgetLimits(data.budgetLimits);
    }
    if (data.shoppingLists) {
      setShoppingLists(data.shoppingLists);
      saveShoppingLists(data.shoppingLists);
    }
    if (data.shoppingItems) {
      setShoppingItems(data.shoppingItems);
      saveShoppingItems(data.shoppingItems);
    }
    logActivity('Przywrócono kopię danych', 'Dane zostały przywrócone z bezpiecznej kopii zapasowej');
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
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
        notifications={notifications}
        household={household}
        currentUser={currentUser}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onTriggerSync={handleTriggerManualSync}
        isSyncing={isSyncing}
        onOpenHouseholdModal={() => {
          setHouseholdModalTab('household');
          setIsHouseholdModalOpen(true);
        }}
        onOpenDeleteDataModal={() => setIsDeleteModalOpen(true)}
        onOpenDataSafetyModal={() => setIsDataSafetyModalOpen(true)}
        onClearNotifications={handleClearNotifications}
        onMarkNotificationRead={handleMarkNotificationRead}
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

      {/* Data Safety & Backups Modal */}
      <DataSafetyModal
        isOpen={isDataSafetyModalOpen}
        onClose={() => setIsDataSafetyModalOpen(false)}
        household={household}
        transactions={transactions}
        bills={bills}
        budgetLimits={budgetLimits}
        shoppingLists={shoppingLists}
        shoppingItems={shoppingItems}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        syncErrorMessage={syncErrorMessage}
        onForceSync={handleForceSync}
        onRestoreData={handleRestoreData}
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
            onUpdateTransaction={handleUpdateTransaction}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'scanner' && (
          <ReceiptScanner
            onAddTransaction={handleAddTransaction}
            onReceiptScanned={handleScannedReceipt}
            shoppingItems={shoppingItems}
            onNavigateToTransactions={() => setActiveTab('transactions')}
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
            onUpdateItem={handleUpdateShoppingItem}
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
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
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
