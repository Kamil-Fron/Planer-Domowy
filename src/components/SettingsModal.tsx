import React, { useState } from 'react';
import {
  X,
  Settings,
  Activity,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  HardDrive,
  Download,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  PlusCircle,
  Edit3,
  FileJson,
  Search,
  Cloud,
  Check,
} from 'lucide-react';
import {
  ActivityLogEntry,
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
  Household,
  UserProfile,
} from '../types';
import {
  DataSnapshot,
  loadBackupSnapshots,
  saveBackupSnapshot,
  deleteBackupSnapshot,
  exportDataToJsonFile,
  scanLocalStorageForLostData,
} from '../storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'activity' | 'sync' | 'safety' | 'version' | 'danger';
  activities: ActivityLogEntry[];
  onRestoreActivityItem: (entry: ActivityLogEntry) => void;
  household: Household | null;
  currentUser: UserProfile;
  isHouseholdAdmin: boolean;
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  syncStatus: 'synced' | 'saving' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  syncErrorMessage: string | null;
  onForceSync: () => Promise<boolean>;
  onRestoreData: (data: {
    transactions?: Transaction[];
    bills?: Bill[];
    budgetLimits?: BudgetLimit[];
    shoppingLists?: ShoppingList[];
    shoppingItems?: ShoppingItem[];
  }) => void;
  onOpenDeleteDataModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'activity',
  activities = [],
  onRestoreActivityItem,
  household,
  currentUser,
  isHouseholdAdmin,
  transactions,
  bills,
  budgetLimits,
  shoppingLists,
  shoppingItems,
  syncStatus,
  lastSyncedAt,
  syncErrorMessage,
  onForceSync,
  onRestoreData,
  onOpenDeleteDataModal,
}) => {
  const [activeTab, setActiveTab] = useState<'activity' | 'sync' | 'safety' | 'version' | 'danger'>(initialTab);
  const [activityFilter, setActivityFilter] = useState<'all' | 'deletions' | 'transactions' | 'bills' | 'shopping'>('all');
  const [activitySearch, setActivitySearch] = useState('');

  // Sync state
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Snapshots state
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>(() => loadBackupSnapshots());
  const [snapshotToRestore, setSnapshotToRestore] = useState<DataSnapshot | null>(null);
  const [snapshotToDelete, setSnapshotToDelete] = useState<DataSnapshot | null>(null);
  const [snapshotActionSuccess, setSnapshotActionSuccess] = useState<string | null>(null);

  // Import JSON two-step state
  const [importedFilePayload, setImportedFilePayload] = useState<{
    fileName: string;
    fileSizeKb: number;
    data: any;
    summary: {
      transactionsCount: number;
      billsCount: number;
      limitsCount: number;
      shoppingItemsCount: number;
    };
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Scanner state
  const [scannerResult, setScannerResult] = useState<{
    scanned: boolean;
    recoveredTransactions: Transaction[];
    recoveredBills: Bill[];
  }>({ scanned: false, recoveredTransactions: [], recoveredBills: [] });

  if (!isOpen) return null;

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (activityFilter === 'deletions' && act.action !== 'delete') return false;
    if (activityFilter === 'transactions' && act.entityType !== 'transaction') return false;
    if (activityFilter === 'bills' && act.entityType !== 'bill') return false;
    if (
      activityFilter === 'shopping' &&
      act.entityType !== 'shopping_item' &&
      act.entityType !== 'shopping_list'
    )
      return false;

    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      const match =
        act.title.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q) ||
        act.authorName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      const ok = await onForceSync();
      if (ok) {
        setSyncFeedback('Sukces: Dane zostały pomyślnie zsynchronizowane z chmurą!');
      } else {
        setSyncFeedback('Uwaga: Wystąpił problem z synchronizacją. Sprawdź sieć.');
      }
    } catch (e: any) {
      setSyncFeedback(`Błąd: ${e.message || 'Problem podczas zapisu'}`);
    } finally {
      setIsSyncingNow(false);
      setSnapshots(loadBackupSnapshots());
    }
  };

  const handleExportJson = () => {
    exportDataToJsonFile({
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
      householdName: household?.name || 'Mój Dom',
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          setImportError('Wskazany plik nie zawiera poprawnej struktury JSON.');
          return;
        }

        const txCount = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;
        const billCount = Array.isArray(parsed.bills) ? parsed.bills.length : 0;
        const limitsCount = Array.isArray(parsed.budgetLimits) ? parsed.budgetLimits.length : 0;
        const shopCount = Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems.length : 0;

        setImportedFilePayload({
          fileName: file.name,
          fileSizeKb: Math.round(file.size / 1024),
          data: parsed,
          summary: {
            transactionsCount: txCount,
            billsCount: billCount,
            limitsCount: limitsCount,
            shoppingItemsCount: shopCount,
          },
        });
      } catch (err: any) {
        setImportError('Błąd odczytu pliku JSON: ' + (err.message || 'Niepoprawny format.'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importedFilePayload) return;

    if (!isHouseholdAdmin) {
      setImportError('Wgrywanie danych z kopii zapasowej jest dozwolone wyłącznie dla administratora gospodarstwa.');
      return;
    }

    // Save safety snapshot before import
    saveBackupSnapshot(`Przed importem pliku ${importedFilePayload.fileName}`, {
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
    });

    const parsed = importedFilePayload.data;
    onRestoreData({
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : undefined,
      bills: Array.isArray(parsed.bills) ? parsed.bills : undefined,
      budgetLimits: Array.isArray(parsed.budgetLimits) ? parsed.budgetLimits : undefined,
      shoppingLists: Array.isArray(parsed.shoppingLists) ? parsed.shoppingLists : undefined,
      shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : undefined,
    });

    setSnapshots(loadBackupSnapshots());
    setImportSuccess(`Pomyślnie zaimportowano dane z pliku "${importedFilePayload.fileName}"!`);
    setImportedFilePayload(null);
  };

  const handleConfirmRestoreSnapshot = () => {
    if (!snapshotToRestore) return;

    saveBackupSnapshot(`Przed przywróceniem: ${snapshotToRestore.label}`, {
      transactions,
      bills,
      budgetLimits,
      shoppingLists,
      shoppingItems,
    });

    onRestoreData({
      transactions: snapshotToRestore.data.transactions,
      bills: snapshotToRestore.data.bills,
      budgetLimits: snapshotToRestore.data.budgetLimits,
      shoppingLists: snapshotToRestore.data.shoppingLists,
      shoppingItems: snapshotToRestore.data.shoppingItems,
    });

    setSnapshots(loadBackupSnapshots());
    setSnapshotActionSuccess(`Pomyślnie przywrócono stan z migawki "${snapshotToRestore.label}"!`);
    setSnapshotToRestore(null);
    setTimeout(() => setSnapshotActionSuccess(null), 4000);
  };

  const handleConfirmDeleteSnapshot = () => {
    if (!snapshotToDelete) return;
    deleteBackupSnapshot(snapshotToDelete.id);
    setSnapshots(loadBackupSnapshots());
    setSnapshotToDelete(null);
    setSnapshotActionSuccess('Migawka została usunięta.');
    setTimeout(() => setSnapshotActionSuccess(null), 3000);
  };

  const handleRunScanner = () => {
    const result = scanLocalStorageForLostData();
    setScannerResult({
      scanned: true,
      recoveredTransactions: result.recoveredTransactions,
      recoveredBills: result.recoveredBills,
    });
  };

  const handleMergeScannedData = () => {
    if (scannerResult.recoveredTransactions.length === 0 && scannerResult.recoveredBills.length === 0) return;

    const txMap = new Map<string, Transaction>();
    transactions.forEach((t) => txMap.set(t.id, t));
    scannerResult.recoveredTransactions.forEach((t) => {
      if (!txMap.has(t.id)) txMap.set(t.id, t);
    });

    const billsMap = new Map<string, Bill>();
    bills.forEach((b) => billsMap.set(b.id, b));
    scannerResult.recoveredBills.forEach((b) => {
      if (!billsMap.has(b.id)) billsMap.set(b.id, b);
    });

    onRestoreData({
      transactions: Array.from(txMap.values()),
      bills: Array.from(billsMap.values()),
    });

    setSnapshotActionSuccess('Scalono odnalezione dane z pamięci podręcznej.');
    setScannerResult({ scanned: false, recoveredTransactions: [], recoveredBills: [] });
  };

  const formatActivityTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Przed chwilą';
      if (diffMins < 60) return `${diffMins} min temu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} godz. temu`;
      return d.toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-4">
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Ustawienia, Aktywność & Bezpieczeństwo
              </h2>
              <p className="text-xs text-slate-400">
                Dziennik zdarzeń z przywracaniem, chmura Firestore, kopie zapasowe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-3.5 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-indigo-600 text-indigo-600 bg-white font-bold rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Dziennik Aktywności ({activities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-3.5 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-indigo-600 text-indigo-600 bg-white font-bold rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Synchronizacja</span>
          </button>

          <button
            onClick={() => setActiveTab('safety')}
            className={`py-3 px-3.5 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-indigo-600 text-indigo-600 bg-white font-bold rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Centrum Bezpieczeństwa & Kopie</span>
          </button>

          <button
            onClick={() => setActiveTab('version')}
            className={`py-3 px-3.5 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'version'
                ? 'border-indigo-600 text-indigo-600 bg-white font-bold rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Opis wersji & UX</span>
          </button>

          <button
            onClick={() => setActiveTab('danger')}
            className={`py-3 px-3.5 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'danger'
                ? 'border-rose-600 text-rose-600 bg-white font-bold rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-rose-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Kosz & Reset</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: DZIENNIK AKTYWNOŚCI & PRZYWRACANIE */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>Dziennik Aktywności Domu</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zapis wszystkich dodanych, zmodyfikowanych i usuniętych pozycji. Możesz przywrócić usunięty wpis.
                  </p>
                </div>

                {/* Filter pills */}
                <div className="flex items-center space-x-1 overflow-x-auto text-[11px] font-semibold bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActivityFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activityFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Wszystkie
                  </button>
                  <button
                    onClick={() => setActivityFilter('deletions')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activityFilter === 'deletions'
                        ? 'bg-rose-50 text-rose-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    Usunięte (Do przywrócenia)
                  </button>
                  <button
                    onClick={() => setActivityFilter('transactions')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activityFilter === 'transactions'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Transakcje
                  </button>
                  <button
                    onClick={() => setActivityFilter('bills')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activityFilter === 'bills'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rachunki
                  </button>
                  <button
                    onClick={() => setActivityFilter('shopping')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activityFilter === 'shopping'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Zakupy
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Filtruj wpisy aktywności po nazwie lub autorze..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Activity entries list */}
              {filteredActivities.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">Brak zarejestrowanych aktywności w wybranym filtrze.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Każda zmiana, dodanie i usunięcie elementu będzie rejestrowana w tym miejscu.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredActivities.map((act) => {
                    const isDelete = act.action === 'delete';
                    const isRestore = act.action === 'restore';
                    const isCreate = act.action === 'create';

                    return (
                      <div
                        key={act.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDelete
                            ? 'bg-rose-50/40 border-rose-100 hover:bg-rose-50/70'
                            : isRestore
                            ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/70'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start space-x-3 min-w-0 flex-1">
                          {/* Icon representation */}
                          <div className="mt-0.5 flex-shrink-0">
                            {isDelete ? (
                              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                <Trash2 className="w-4 h-4" />
                              </div>
                            ) : isRestore ? (
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                <RotateCcw className="w-4 h-4" />
                              </div>
                            ) : isCreate ? (
                              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                <PlusCircle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <Edit3 className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="text-xs font-bold text-slate-900 leading-tight">
                                {act.title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  isDelete
                                    ? 'bg-rose-100 text-rose-800'
                                    : isRestore
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCreate
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {isDelete
                                  ? 'Usunięto'
                                  : isRestore
                                  ? 'Przywrócono'
                                  : isCreate
                                  ? 'Dodano'
                                  : 'Edycja'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatActivityTime(act.timestamp)}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 mt-1 leading-snug">
                              {act.description}
                            </p>

                            <div className="mt-1.5 flex items-center space-x-2 text-[10px] text-slate-400">
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="font-semibold text-slate-700">{act.authorName}</span>
                              </span>
                              <span>•</span>
                              <span className="uppercase text-[9px] font-bold tracking-wider text-slate-400">
                                {act.entityType}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons (Restore deleted item) */}
                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                          {isDelete && (act.deletedPayload || act.snapshot) && (
                            act.restored ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center space-x-1">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Wpis przywrócony</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => onRestoreActivityItem(act)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center space-x-1.5"
                                title="Kliknij, aby cofnąć usunięcie i przywrócić ten element do bazy"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Przywróć wpis</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SYNCHRONIZACJA Z CHMURĄ */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Cloud className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-900">Stan połączenia z bazą chmurową</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-100 text-emerald-800'
                        : syncStatus === 'saving' || isSyncingNow
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : syncStatus === 'error'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        syncStatus === 'synced'
                          ? 'bg-emerald-500'
                          : syncStatus === 'saving' || isSyncingNow
                          ? 'bg-blue-500'
                          : syncStatus === 'error'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span>
                      {syncStatus === 'synced'
                        ? 'Zsynchronizowano'
                        : syncStatus === 'saving' || isSyncingNow
                        ? 'Zapisywanie...'
                        : syncStatus === 'error'
                        ? 'Błąd zapisu'
                        : 'Tryb lokalny'}
                    </span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Aplikacja w czasie rzeczywistym synchronizuje wszystkie wydatki, wpływy, listy zakupów i rachunki z bazą Google Cloud Firestore.
                  Zmiany wprowadzane przez jednego domownika są natychmiast widoczne u pozostałych członków gospodarstwa.
                </p>

                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <span>
                    Ostatnia udana synchronizacja:{' '}
                    <strong className="text-slate-800">
                      {lastSyncedAt
                        ? `${lastSyncedAt.toLocaleTimeString('pl-PL')} (${lastSyncedAt.toLocaleDateString('pl-PL')})`
                        : 'Brak wcześniejszych zapisów'}
                    </strong>
                  </span>
                  {household?.inviteCode && (
                    <span>
                      Kod gospodarstwa: <code className="font-bold text-indigo-700">{household.inviteCode}</code>
                    </span>
                  )}
                </div>

                {syncErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-mono">
                    {syncErrorMessage}
                  </div>
                )}
              </div>

              {/* Force Sync button */}
              <button
                onClick={handleManualSync}
                disabled={isSyncingNow || syncStatus === 'saving'}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingNow
                    ? 'Trwa synchronizacja z Firestore...'
                    : 'Wymuś natychmiastowy zapis i synchronizację z chmurą'}
                </span>
              </button>

              {syncFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold text-center border animate-in fade-in ${
                    syncFeedback.startsWith('Sukces')
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {syncFeedback}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CENTRUM BEZPIECZEŃSTWA & KOPIE DANYCH (IMPROVED READABILITY) */}
          {activeTab === 'safety' && (
            <div className="space-y-6">
              {/* Feedback toast for snapshots actions */}
              {snapshotActionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{snapshotActionSuccess}</span>
                </div>
              )}

              {/* SECTION 1: MIGAWEK HISTORII */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-indigo-600" />
                      <span>Migawki Lokalne (Automatyczne & Ręczne)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Migawki zachowują pełny stan aplikacji w danym momencie. Możesz w każdej chwili bezpiecznie cofnąć zmiany.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      saveBackupSnapshot('Ręczna migawka bezpieczeństwa', {
                        transactions,
                        bills,
                        budgetLimits,
                        shoppingLists,
                        shoppingItems,
                      });
                      setSnapshots(loadBackupSnapshots());
                      setSnapshotActionSuccess('Utworzono nową ręczną migawkę stanu danych.');
                      setTimeout(() => setSnapshotActionSuccess(null), 3000);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Utwórz migawkę teraz</span>
                  </button>
                </div>

                {snapshots.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    Brak zapisanych migawek w pamięci.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:border-indigo-200 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 truncate">{snap.label}</span>
                            <span className="text-[10px] text-slate-400 flex items-center space-x-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(snap.timestamp).toLocaleString('pl-PL')}</span>
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-3 text-[11px] text-slate-500">
                            <span>Transakcje: <strong>{snap.counts.transactions}</strong></span>
                            <span>•</span>
                            <span>Rachunki: <strong>{snap.counts.bills}</strong></span>
                            <span>•</span>
                            <span>Limity: <strong>{snap.counts.budgetLimits}</strong></span>
                            <span>•</span>
                            <span>Rzeczy: <strong>{snap.counts.shoppingItems}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            onClick={() => setSnapshotToRestore(snap)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1"
                            title="Przywróć tę migawkę"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Przywróć</span>
                          </button>
                          <button
                            onClick={() => setSnapshotToDelete(snap)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Usuń tę migawkę"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: EKSPORT & IMPORT DANYCH (JSON) WITH 2-STEP CONFIRMATION */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <FileJson className="w-4 h-4 text-indigo-600" />
                    <span>Eksport i Import Pliku JSON</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pobierz plik ze wszystkimi danymi na dysk lub wgraj wcześniej pobraną kopię zapasową z podglądem i zatwierdzeniem.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Eksport */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Pobierz kopię (Eksport)</span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Zapisuje wszystkie transakcje, rachunki, listy i limity w bezpiecznym pliku JSON.
                      </p>
                    </div>
                    <button
                      onClick={handleExportJson}
                      className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Eksportuj do JSON</span>
                    </button>
                  </div>

                  {/* Import */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Wgraj z pliku (Import)</span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Krok 1: Wskaż plik z dysku. Przed wgraniem zobaczysz dokładny podgląd danych do zatwierdzenia.
                      </p>
                    </div>

                    {!isHouseholdAdmin ? (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[10px] font-medium">
                        Tylko administrator gospodarstwa domowego ma uprawnienia do wgrywania kopii zapasowej.
                      </div>
                    ) : (
                      <label className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Wybierz plik kopii...</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleFileSelected}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* TWO-STEP IMPORT CONFIRMATION BOX */}
                {importedFilePayload && (
                  <div className="p-4 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileJson className="w-5 h-5 text-indigo-600" />
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">
                            Wczytano plik: {importedFilePayload.fileName}
                          </h5>
                          <span className="text-[10px] text-slate-500">
                            Rozmiar: {importedFilePayload.fileSizeKb} KB
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                        Oczekuje na zatwierdzenie
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-400 block uppercase">Transakcje</span>
                        <span className="font-bold text-indigo-950 text-sm">
                          {importedFilePayload.summary.transactionsCount}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-400 block uppercase">Rachunki</span>
                        <span className="font-bold text-indigo-950 text-sm">
                          {importedFilePayload.summary.billsCount}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-400 block uppercase">Limity</span>
                        <span className="font-bold text-indigo-950 text-sm">
                          {importedFilePayload.summary.limitsCount}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-400 block uppercase">Produkty</span>
                        <span className="font-bold text-indigo-950 text-sm">
                          {importedFilePayload.summary.shoppingItemsCount}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                      Zatwierdzenie spowoduje zastąpienie obecnych danych zawartością pliku. Automatycznie zostanie utworzona migawka bezpieczeństwa przed importem.
                    </p>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setImportedFilePayload(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Zatwierdź i wgraj dane do aplikacji</span>
                      </button>
                    </div>
                  </div>
                )}

                {importError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{importSuccess}</span>
                  </div>
                )}
              </div>

              {/* SECTION 3: SKANER PAMIĘCI LOKALNEJ */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Search className="w-4 h-4 text-indigo-600" />
                      <span>Skaner Pamięci Podręcznej Przeglądarki</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Przeszukuje pamięć podręczną pod kątem starych lub utraconych transakcji i rachunków.
                    </p>
                  </div>
                  <button
                    onClick={handleRunScanner}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Uruchom skaner</span>
                  </button>
                </div>

                {scannerResult.scanned && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs animate-in fade-in">
                    <p className="font-semibold text-slate-800">
                      Wynik skanowania: Znaleziono <strong>{scannerResult.recoveredTransactions.length}</strong> transakcji i <strong>{scannerResult.recoveredBills.length}</strong> rachunków.
                    </p>
                    {(scannerResult.recoveredTransactions.length > 0 || scannerResult.recoveredBills.length > 0) && (
                      <button
                        onClick={handleMergeScannedData}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                      >
                        Scal odnalezione pozycje z obecną bazą
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: OPIS WERSJI & UX */}
          {activeTab === 'version' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">Planer Budżetu Domowego • Wersja 2.7.0</h3>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      Autor: bobEKam
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Nowoczesny system zarządzania finansami domowymi zsynchronizowany z chmurą Google Cloud Firestore.
                    Aplikacja zapewnia pełną kontrolę nad wydatkami, rachunkami, listami zakupów oraz kredytem hipotecznym.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-900 block">Separacja Powiadomień i Aktywności</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Aktywności domowników są archiwizowane w osobnym dzienniku w ustawieniach z możliwością cofania usunięć. Powiadomienia w menu skupiają się wyłącznie na aktualnych zadaniach i alertach.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-900 block">Wielopoziomowe Bezpieczeństwo Danych</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Automatyczne tworzenie migawek przy każdej edycji, weryfikacja zapisu w chmurze Firestore oraz dwuetapowy import plików z potwierdzeniem.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-900 block">Zarządzanie Domownikami</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Bezpieczne dołączanie kodem z zatwierdzaniem przez administratora gospodarstwa domowego. Ochrona przed nieuprawnionym kasowaniem danych.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-900 block">Mobilne i Desktopowe Powiadomienia</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Wyskakujące banery stylizowane na natywne powiadomienia smartfona z płynnym gestem odrzucenia i bezpośrednim przejściem do szczegółów wpisu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KOSZ & RESET DANYCH */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h4 className="text-sm font-bold text-rose-950">Zarządzanie Danymi i Czyszczenie Bazy</h4>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Operacje w tej sekcji trwale modyfikują zawartość bazy danych. Przed wykonaniem jakiejkolwiek akcji automatycznie tworzona jest migawka bezpieczeństwa.
                </p>
              </div>

              {!isHouseholdAdmin ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-semibold space-y-1">
                  <p>⚠️ Ograniczenie uprawnień:</p>
                  <p className="font-normal text-amber-800">
                    Jesteś członkiem gospodarstwa domowego. Zbiorcze usuwanie danych i resetowanie bazy jest zastrzeżone wyłącznie dla właściciela/administratora tego domu.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Usuń wybrane kategorie danych...</span>
                      <span className="text-[11px] text-slate-500">
                        Otwiera kreator selektywnego usuwania (same wydatki, same rachunki lub same listy zakupów)
                      </span>
                    </div>
                    {onOpenDeleteDataModal && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenDeleteDataModal();
                        }}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Kreator usuwania</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Zalogowany jako: <strong className="text-slate-800">{currentUser.name || 'Gość'}</strong>{' '}
            {household && `• ${household.name}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>

      {/* CONFIRMATION MODAL FOR RESTORING SNAPSHOT */}
      {snapshotToRestore && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Potwierdź przywrócenie migawki</h4>
                <p className="text-xs text-slate-500">{snapshotToRestore.label}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p className="text-slate-600">
                Data utworzenia: <strong>{new Date(snapshotToRestore.timestamp).toLocaleString('pl-PL')}</strong>
              </p>
              <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-slate-700">
                <div>Transakcje: <strong>{snapshotToRestore.counts.transactions}</strong></div>
                <div>Rachunki: <strong>{snapshotToRestore.counts.bills}</strong></div>
                <div>Limity: <strong>{snapshotToRestore.counts.budgetLimits}</strong></div>
                <div>Rzeczy w listach: <strong>{snapshotToRestore.counts.shoppingItems}</strong></div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Czy na pewno chcesz przywrócić tę migawkę? Twoje obecne dane zostaną zastąpione stanem z wybranej kopii. Przed przywróceniem aplikacja wykona automatyczną kopię bezpieczeństwa aktualnego stanu.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSnapshotToRestore(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleConfirmRestoreSnapshot}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Tak, przywróć ten stan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETING SNAPSHOT */}
      {snapshotToDelete && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Usuń wybraną migawkę</h4>
                <p className="text-xs text-slate-500">{snapshotToDelete.label}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Czy na pewno chcesz usunąć tę migawkę zapisaną z dnia {new Date(snapshotToDelete.timestamp).toLocaleString('pl-PL')}? Tej operacji nie można cofnąć.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSnapshotToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleConfirmDeleteSnapshot}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Usuń migawkę
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
