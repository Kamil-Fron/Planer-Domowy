import React, { useState } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  DollarSign,
  Calendar,
  Layers,
  ShoppingCart,
  Home,
  Check,
} from 'lucide-react';
import { Bill, BudgetLimit, Household, ShoppingItem, ShoppingList, Transaction } from '../types';

export interface DeleteSelection {
  transactions: boolean;
  bills: boolean;
  budgetLimits: boolean;
  shopping: boolean;
  household: boolean;
}

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  household: Household | null;
  onConfirmDelete: (selection: DeleteSelection) => void;
}

export const DeleteDataModal: React.FC<DeleteDataModalProps> = ({
  isOpen,
  onClose,
  transactions,
  bills,
  budgetLimits,
  shoppingLists,
  shoppingItems,
  household,
  onConfirmDelete,
}) => {
  const [selection, setSelection] = useState<DeleteSelection>({
    transactions: true,
    bills: true,
    budgetLimits: false,
    shopping: true,
    household: false,
  });

  const [confirmStep, setConfirmStep] = useState(false);
  const [deletedDone, setDeletedDone] = useState(false);

  if (!isOpen) return null;

  const toggleAll = (checked: boolean) => {
    setSelection({
      transactions: checked,
      bills: checked,
      budgetLimits: checked,
      shopping: checked,
      household: checked,
    });
  };

  const selectedCount = Object.values(selection).filter(Boolean).length;

  const handleExecuteDelete = () => {
    onConfirmDelete(selection);
    setDeletedDone(true);
    setTimeout(() => {
      setDeletedDone(false);
      setConfirmStep(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/20 text-white border border-white/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Usuwanie wybranych danych</h2>
              <p className="text-xs text-rose-100">Wybierz elementy, które chcesz wyczyścić</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-rose-200 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {deletedDone ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Pomyślnie usunięto wybrane dane!</h3>
              <p className="text-xs text-slate-500">Baza danych i pamięć lokalna zostały zaktualizowane.</p>
            </div>
          ) : !confirmStep ? (
            <>
              {/* Info & Select All controls */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kategorie do usunięcia:
                </span>
                <div className="flex space-x-2 text-xs">
                  <button
                    onClick={() => toggleAll(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Zaznacz wszystkie
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => toggleAll(false)}
                    className="text-slate-500 hover:text-slate-700 font-semibold"
                  >
                    Odznacz
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                {/* 1. Transakcje */}
                <label
                  className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selection.transactions
                      ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {selection.transactions ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-slate-700" />
                        <span className="text-xs font-bold text-slate-900">
                          Wydatki i przychody (Transakcje)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Historia wpisów, paragony, wydatki ze wszystkich kategorii
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                    {transactions.length} poz.
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selection.transactions}
                    onChange={(e) =>
                      setSelection({ ...selection, transactions: e.target.checked })
                    }
                  />
                </label>

                {/* 2. Rachunki */}
                <label
                  className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selection.bills
                      ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {selection.bills ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-700" />
                        <span className="text-xs font-bold text-slate-900">
                          Rachunki i opłaty stałe
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Czynsz, prąd, abonamenty, harmonogram terminów płatności
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                    {bills.length} poz.
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selection.bills}
                    onChange={(e) => setSelection({ ...selection, bills: e.target.checked })}
                  />
                </label>

                {/* 3. Limity budżetowe */}
                <label
                  className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selection.budgetLimits
                      ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {selection.budgetLimits ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-700" />
                        <span className="text-xs font-bold text-slate-900">
                          Limity budżetowe kategorii
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ustawione miesięczne limity kwotowe oraz progi powiadomień
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                    {budgetLimits.length} poz.
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selection.budgetLimits}
                    onChange={(e) =>
                      setSelection({ ...selection, budgetLimits: e.target.checked })
                    }
                  />
                </label>

                {/* 4. Listy zakupów */}
                <label
                  className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selection.shopping
                      ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {selection.shopping ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-slate-700" />
                        <span className="text-xs font-bold text-slate-900">
                          Listy zakupów & produkty
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Wszystkie listy sklepowe wraz z elementami do kupienia
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                    {shoppingLists.length} list ({shoppingItems.length} prod.)
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selection.shopping}
                    onChange={(e) => setSelection({ ...selection, shopping: e.target.checked })}
                  />
                </label>

                {/* 5. Dom / Household */}
                {household && (
                  <label
                    className={`flex items-start justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selection.household
                        ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {selection.household ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <Home className="w-3.5 h-3.5 text-slate-700" />
                          <span className="text-xs font-bold text-slate-900">
                            Odłącz powiązanie z Domem ({household.name})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Resetuje przypisanie do gospodarstwa domowego (kod: {household.inviteCode})
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                      1 dom
                    </span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selection.household}
                      onChange={(e) =>
                        setSelection({ ...selection, household: e.target.checked })
                      }
                    />
                  </label>
                )}
              </div>

              {/* Warning note */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-2 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Uwaga:</strong> Usunięcie wybranych elementów jest trwałe i wpłynie na dane lokalne oraz synchronizację w chmurze Firestore.
                </p>
              </div>
            </>
          ) : (
            /* Confirm Step */
            <div className="py-4 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Czy na pewno chcesz usunąć te dane?</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Zaznaczono <strong>{selectedCount}</strong> kategorii do trwałego usunięcia. Tej operacji nie można cofnąć.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1 max-w-xs mx-auto">
                {selection.transactions && <p className="text-rose-700 font-semibold">• Wszystkie transakcje ({transactions.length})</p>}
                {selection.bills && <p className="text-rose-700 font-semibold">• Wszystkie rachunki ({bills.length})</p>}
                {selection.budgetLimits && <p className="text-rose-700 font-semibold">• Limity budżetowe ({budgetLimits.length})</p>}
                {selection.shopping && <p className="text-rose-700 font-semibold">• Listy zakupów ({shoppingLists.length})</p>}
                {selection.household && <p className="text-rose-700 font-semibold">• Odłączenie od Domu</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!deletedDone && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => {
                if (confirmStep) setConfirmStep(false);
                else onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Anuluj
            </button>

            {!confirmStep ? (
              <button
                onClick={() => setConfirmStep(true)}
                disabled={selectedCount === 0}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Usuń zaznaczone ({selectedCount})</span>
              </button>
            ) : (
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tak, usuń bezpowrotnie</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
