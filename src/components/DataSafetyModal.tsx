import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  FileJson,
  Search,
  HardDrive,
  Cloud,
} from 'lucide-react';
import {
  DataSnapshot,
  loadBackupSnapshots,
  exportDataToJsonFile,
  scanLocalStorageForLostData,
  saveBackupSnapshot,
} from '../storage';
import { Transaction, Bill, BudgetLimit, ShoppingList, ShoppingItem, Household } from '../types';

interface DataSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: Household | null;
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
}

export const DataSafetyModal: React.FC<DataSafetyModalProps> = ({
  isOpen,
  onClose,
  household,
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
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'snapshots' | 'export_import' | 'scanner'>('status');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>(() => loadBackupSnapshots());
  const [scannerResult, setScannerResult] = useState<{
    scanned: boolean;
    recoveredTransactions: Transaction[];
    recoveredBills: Bill[];
  }>({ scanned: false, recoveredTransactions: [], recoveredBills: [] });

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      const ok = await onForceSync();
      if (ok) {
        setSyncFeedback('Sukces: Dane zostały pomyślnie i bezbłędnie zapisane w bazie Firestore!');
      } else {
        setSyncFeedback('Uwaga: Wystąpił problem z zapisem do bazy. Sprawdź połączenie.');
      }
    } catch (e: any) {
      setSyncFeedback(`Błąd: ${e.message || 'Nieznany problem z zapisem'}`);
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

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          alert('Plik nie zawiera poprawnego obiektu JSON.');
          return;
        }

        const txCount = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;
        const billCount = Array.isArray(parsed.bills) ? parsed.bills.length : 0;

        const confirmMsg = `Wczytano plik kopii zapasowej!\nZnaleziono:\n- ${txCount} transakcji\n- ${billCount} rachunków\n\nCzy chcesz teraz przywrócić te dane? Aktualne dane zostaną zachowane w kopii awaryjnej.`;
        if (window.confirm(confirmMsg)) {
          // Save safety snapshot before restoring
          saveBackupSnapshot('Przed importem z pliku JSON', {
            transactions,
            bills,
            budgetLimits,
            shoppingLists,
            shoppingItems,
          });

          onRestoreData({
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : undefined,
            bills: Array.isArray(parsed.bills) ? parsed.bills : undefined,
            budgetLimits: Array.isArray(parsed.budgetLimits) ? parsed.budgetLimits : undefined,
            shoppingLists: Array.isArray(parsed.shoppingLists) ? parsed.shoppingLists : undefined,
            shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : undefined,
          });

          setSnapshots(loadBackupSnapshots());
          alert('Kopia zapasowa została pomyślnie wczytana!');
        }
      } catch (err: any) {
        alert('Błąd odczytu pliku JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input value so user can select the same file again if needed
    e.target.value = '';
  };

  const handleRestoreSnapshot = (snapshot: DataSnapshot) => {
    const confirmMsg = `Czy na pewno chcesz przywrócić migawkę z "${snapshot.label}" (${new Date(
      snapshot.timestamp
    ).toLocaleString('pl-PL')})?\nZawiera: ${snapshot.counts.transactions} transakcji i ${
      snapshot.counts.bills
    } rachunków.`;

    if (window.confirm(confirmMsg)) {
      saveBackupSnapshot('Przed przywróceniem migawki: ' + snapshot.label, {
        transactions,
        bills,
        budgetLimits,
        shoppingLists,
        shoppingItems,
      });

      onRestoreData({
        transactions: snapshot.data.transactions,
        bills: snapshot.data.bills,
        budgetLimits: snapshot.data.budgetLimits,
        shoppingLists: snapshot.data.shoppingLists,
        shoppingItems: snapshot.data.shoppingItems,
      });

      setSnapshots(loadBackupSnapshots());
      alert('Pomyślnie przywrócono stan z wybranej migawki!');
    }
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
    if (scannerResult.recoveredTransactions.length === 0 && scannerResult.recoveredBills.length === 0) {
      alert('Brak znalezionych danych do scalenia.');
      return;
    }

    // Merge transactions
    const txMap = new Map<string, Transaction>();
    transactions.forEach((t) => txMap.set(t.id, t));
    scannerResult.recoveredTransactions.forEach((t) => {
      if (!txMap.has(t.id)) txMap.set(t.id, t);
    });

    // Merge bills
    const billsMap = new Map<string, Bill>();
    bills.forEach((b) => billsMap.set(b.id, b));
    scannerResult.recoveredBills.forEach((b) => {
      if (!billsMap.has(b.id)) billsMap.set(b.id, b);
    });

    onRestoreData({
      transactions: Array.from(txMap.values()),
      bills: Array.from(billsMap.values()),
    });

    alert(
      `Scalono odnalezione dane! Łącznie transakcji: ${txMap.size}, łącznie rachunków: ${billsMap.size}. Dane zostaną zsynchronizowane z bazą.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Centrum Bezpieczeństwa & Kopii Danych</h2>
              <p className="text-xs text-slate-400">
                Weryfikacja zapisu w chmurze, tworzenie kopii JSON i historia wersji
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Stan Bazy & Zapis</span>
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Migawki Lokalne ({snapshots.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('export_import')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'export_import'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Eksport / Import JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Skaner Pamięci</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {/* TAB 1: STATUS & CLOUD SYNC */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Sync Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : syncStatus === 'saving'
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                {syncStatus === 'synced' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {syncStatus === 'saving' && (
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" />
                )}
                {syncStatus === 'error' && (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-bold text-sm">
                    {syncStatus === 'synced' && 'Baza w chmurze jest w pełni zsynchronizowana'}
                    {syncStatus === 'saving' && 'Trwa zapisywanie zmian do chmury Firestore...'}
                    {syncStatus === 'error' && 'Wystąpił problem z zapisem do chmury!'}
                  </div>
                  <p className="mt-1 text-slate-600">
                    {lastSyncedAt
                      ? `Ostatni udany zapis: ${lastSyncedAt.toLocaleTimeString('pl-PL')} (${lastSyncedAt.toLocaleDateString('pl-PL')})`
                      : 'Czekam na pierwszą synchronizację...'}
                  </p>
                  {syncErrorMessage && (
                    <div className="mt-2 p-2 bg-rose-100 rounded-lg text-rose-800 font-mono text-[11px]">
                      {syncErrorMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Household Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Aktywny dom (Firestore)
                  </span>
                  <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                    {household?.inviteCode || 'Brak kodu'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Transakcje</span>
                    <span className="text-base font-black text-slate-900">{transactions.length}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Rachunki</span>
                    <span className="text-base font-black text-slate-900">{bills.length}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Limity</span>
                    <span className="text-base font-black text-slate-900">{budgetLimits.length}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Listy / Rzeczy</span>
                    <span className="text-base font-black text-slate-900">
                      {shoppingLists.length} / {shoppingItems.length}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">ID Dokumentu w Firestore:</span>{' '}
                  <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800">
                    {household?.id || 'hh-1788350089790'}
                  </code>
                </div>
              </div>

              {/* Force Sync Action Button */}
              <div>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncingNow}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-xs"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncingNow ? 'Zapisuję i weryfikuję bazę...' : 'Wymuś natychmiastowy zapis do bazy (Zsynchronizuj teraz)'}
                  </span>
                </button>

                {syncFeedback && (
                  <p className="mt-2 text-xs text-center font-medium text-slate-700 animate-in fade-in">
                    {syncFeedback}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Historia automatycznych kopii (Migawki)</h3>
                  <p className="text-[11px] text-slate-500">
                    Aplikacja tworzy wersję bezpieczeństwa przy każdej edycji i synchronizacji.
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
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Stwórz migawkę teraz</span>
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Brak zapisanych migawek. Utwórz pierwszą migawkę powyżej!
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs transition-colors"
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
                          <span>Transakcje: {snap.counts.transactions}</span>
                          <span>•</span>
                          <span>Rachunki: {snap.counts.bills}</span>
                          <span>•</span>
                          <span>Limity: {snap.counts.budgetLimits}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRestoreSnapshot(snap)}
                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs transition-colors shrink-0 flex items-center space-x-1"
                        title="Przywróć tę wersję"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Przywróć</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXPORT & IMPORT JSON */}
          {activeTab === 'export_import' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Pobierz pełną kopię na swój komputer / telefon</span>
                </div>
                <p className="text-xs text-slate-600">
                  Zawsze masz 100% kontroli nad swoimi danymi. Kliknij przycisk poniżej, aby pobrać plik{' '}
                  <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-900">.json</code> ze
                  wszystkimi transakcjami, rachunkami, limitami i paragonami.
                </p>
                <button
                  onClick={handleExportJson}
                  className="mt-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Pobierz plik kopii (.JSON)</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Wczytaj kopię zapasową z pliku JSON</span>
                </div>
                <p className="text-xs text-slate-600">
                  Jeśli chcesz przywrócić dane z wcześniej pobranego pliku JSON, wybierz go ze swojego dysku:
                </p>
                <label className="inline-flex items-center space-x-2 py-2 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Wybierz plik kopii (.JSON)...</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: SCANNER */}
          {activeTab === 'scanner' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-amber-900 font-bold">
                  <Search className="w-4 h-4 text-amber-700" />
                  <span>Awaryjny skaner pamięci podręcznej przeglądarki</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Ten skaner przeszukuje całą pamięć podręczną Twojej przeglądarki w poszukiwaniu wszelkich wcześniejszych
                  obiektów transakcji lub rachunków, które mogły zostać zapisane w lokalnych kluczach lub sesjach.
                </p>
                <button
                  onClick={handleRunScanner}
                  className="py-2 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl font-bold transition-colors flex items-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Rozpocznij skanowanie pamięci podręcznej</span>
                </button>
              </div>

              {scannerResult.scanned && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-bold text-slate-900">Wyniki skanowania:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Znalezione transakcje:</span>
                      <span className="text-lg font-black text-slate-900">
                        {scannerResult.recoveredTransactions.length}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Znalezione rachunki:</span>
                      <span className="text-lg font-black text-slate-900">
                        {scannerResult.recoveredBills.length}
                      </span>
                    </div>
                  </div>

                  {scannerResult.recoveredTransactions.length > 0 || scannerResult.recoveredBills.length > 0 ? (
                    <div className="pt-2">
                      <button
                        onClick={handleMergeScannedData}
                        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Scal odnalezione dane z bieżącym budżetem</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Nie odnaleziono innych ukrytych wpisów w pamięci podręcznej bieżącej przeglądarki.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
