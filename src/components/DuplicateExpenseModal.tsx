import React from 'react';
import { AlertTriangle, Calendar, Tag, FileText, ShoppingBag, Check, X } from 'lucide-react';
import { Transaction } from '../types';
import { DuplicateCandidate } from '../utils/duplicateExpenseCheck';

export interface DuplicateExpenseModalProps {
  isOpen: boolean;
  candidate: DuplicateCandidate | null;
  matchingTransaction: Transaction | null;
  totalMatchesCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DuplicateExpenseModal: React.FC<DuplicateExpenseModalProps> = ({
  isOpen,
  candidate,
  matchingTransaction,
  totalMatchesCount = 1,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !candidate || !matchingTransaction) return null;

  const candidateItems = candidate.receiptItems || [];
  const existingItems = matchingTransaction.receiptItems || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5 border-b border-amber-100 flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 mb-1">
                Wykryto potencjalny duplikat wydatku
              </span>
              <h2 id="duplicate-modal-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                Czy chcesz jeszcze raz dodać taki wydatek?
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Zauważono, że data (<span className="font-semibold text-slate-900">{candidate.date}</span>) oraz kwota (
                <span className="font-semibold text-slate-900">{candidate.amount.toFixed(2)} PLN</span>) powtarzają się z istniejącym wpisem
                {totalMatchesCount > 1 ? ` (znaleziono ${totalMatchesCount} pasujące wpisy)` : ''}.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-white/80 transition-colors"
            title="Zamknij (nie dodawaj)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600">
            Poniżej znajduje się fragment obu wydatków dla potwierdzenia, czy to dokładnie ten sam paragon/wydatek dodawany omyłkowo, czy jedynie zbieg okoliczności:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Existing in Database */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Już w budżecie
                </span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  {matchingTransaction.amount.toFixed(2)} PLN
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 break-words">
                  {matchingTransaction.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {matchingTransaction.date}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {matchingTransaction.category}
                  </span>
                </div>
              </div>

              {matchingTransaction.comment && (
                <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-slate-100 break-words">
                  {matchingTransaction.comment}
                </p>
              )}

              {/* Snippet of receipt items if present */}
              {existingItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 text-slate-400" />
                    Fragment pozycji z paragonu ({existingItems.length}):
                  </p>
                  <ul className="text-[11px] text-slate-600 space-y-1 bg-white p-2 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                    {existingItems.slice(0, 4).map((it, idx) => (
                      <li key={idx} className="flex justify-between items-center gap-2">
                        <span className="truncate">{it.name}</span>
                        <span className="font-medium shrink-0">
                          {typeof it.price === 'number' ? `${it.price.toFixed(2)} zł` : ''}
                        </span>
                      </li>
                    ))}
                    {existingItems.length > 4 && (
                      <li className="text-[10px] text-slate-400 italic text-center pt-0.5">
                        + jeszcze {existingItems.length - 4} innych pozycji...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Card 2: New Candidate to Add */}
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <span className="text-[11px] font-bold uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-indigo-500" />
                  Nowy wpis (teraz)
                </span>
                <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md">
                  {candidate.amount.toFixed(2)} PLN
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 break-words">
                  {candidate.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-indigo-200/60">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {candidate.date}
                  </span>
                  {candidate.category && (
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-indigo-200/60">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {candidate.category}
                    </span>
                  )}
                </div>
              </div>

              {candidate.comment && (
                <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-indigo-100 break-words">
                  {candidate.comment}
                </p>
              )}

              {/* Snippet of candidate items if present */}
              {candidateItems.length > 0 && (
                <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                  <p className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 text-indigo-500" />
                    Fragment pozycji z nowego skanu ({candidateItems.length}):
                  </p>
                  <ul className="text-[11px] text-slate-600 space-y-1 bg-white p-2 rounded-lg border border-indigo-200/80 max-h-28 overflow-y-auto">
                    {candidateItems.slice(0, 4).map((it, idx) => (
                      <li key={idx} className="flex justify-between items-center gap-2">
                        <span className="truncate">{it.name}</span>
                        <span className="font-medium shrink-0">
                          {typeof it.price === 'number' ? `${it.price.toFixed(2)} zł` : ''}
                        </span>
                      </li>
                    ))}
                    {candidateItems.length > 4 && (
                      <li className="text-[10px] text-slate-400 italic text-center pt-0.5">
                        + jeszcze {candidateItems.length - 4} innych pozycji...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>Nie dodawaj (to ten sam wydatek)</span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Tak, dodaj jeszcze raz (zbieg okoliczności)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
