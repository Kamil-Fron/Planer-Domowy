import React from 'react';
import {
  TrendingDown,
  Percent,
  Landmark,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DebtItem } from '../types';

export interface DebtRepaymentLivePreviewProps {
  debt: DebtItem;
  totalPayment: number;
  principalPayment: number;
  interestPayment: number;
  paymentType?: 'regular' | 'overpayment';
  currency?: string;
  className?: string;
  isCompact?: boolean;
}

export const DebtRepaymentLivePreview: React.FC<DebtRepaymentLivePreviewProps> = ({
  debt,
  totalPayment,
  principalPayment,
  interestPayment,
  paymentType = 'regular',
  currency = 'zł',
  className = '',
  isCompact = false,
}) => {
  const initialRemaining = Math.max(0, debt.currentRemaining || 0);
  const totalAmount = debt.totalAmount || debt.initialAmount || initialRemaining;
  const currentPaid = Math.max(0, debt.paidAmount || (totalAmount - initialRemaining));

  // Bezpieczne wartości liczbowe
  const safeTotal = Math.max(0, isNaN(totalPayment) ? 0 : totalPayment);
  const safePrincipal = Math.max(0, isNaN(principalPayment) ? 0 : principalPayment);
  const safeInterest = Math.max(0, isNaN(interestPayment) ? 0 : interestPayment);

  // Nowy stan po spłacie kapitału
  const projectedRemaining = Math.max(0, Math.round((initialRemaining - safePrincipal) * 100) / 100);
  const projectedPaid = Math.round((currentPaid + safePrincipal) * 100) / 100;

  // Wskaźniki logiczne
  const isOverpaid = initialRemaining > 0 && safePrincipal > initialRemaining + 0.009;
  const overpaidAmount = isOverpaid ? Math.round((safePrincipal - initialRemaining) * 100) / 100 : 0;
  const isFullySettled = initialRemaining > 0 && projectedRemaining <= 0.009 && !isOverpaid;

  // Procenty podziału raty
  const totalEntered = safePrincipal + safeInterest;
  const principalShare = totalEntered > 0 ? (safePrincipal / totalEntered) * 100 : (safeTotal > 0 ? (safePrincipal / safeTotal) * 100 : 100);
  const interestShare = totalEntered > 0 ? (safeInterest / totalEntered) * 100 : (safeTotal > 0 ? (safeInterest / safeTotal) * 100 : 0);

  // Postęp spłaty całego zadłużenia
  const currentProgressPercent = totalAmount > 0 ? Math.min(100, Math.max(0, (currentPaid / totalAmount) * 100)) : 0;
  const projectedProgressPercent = totalAmount > 0 ? Math.min(100, Math.max(0, (projectedPaid / totalAmount) * 100)) : 0;
  const progressDelta = Math.max(0, projectedProgressPercent - currentProgressPercent);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        isOverpaid
          ? 'bg-rose-50/70 border-rose-200'
          : isFullySettled
          ? 'bg-emerald-50/70 border-emerald-300'
          : 'bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 border-indigo-200/90'
      } ${isCompact ? 'p-3 text-xs' : 'p-4 text-xs'} ${className}`}
    >
      {/* Nagłówek wskaźnika na żywo */}
      <div className="flex items-center justify-between pb-2.5 border-b border-indigo-100/70">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOverpaid ? 'bg-rose-400' : isFullySettled ? 'bg-emerald-400' : 'bg-indigo-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isOverpaid ? 'bg-rose-500' : isFullySettled ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
            />
          </span>
          <span className="font-extrabold uppercase tracking-wider text-[10px] text-indigo-900 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>Podgląd na żywo: stan zadłużenia po wpłacie</span>
          </span>
        </div>

        {paymentType === 'overpayment' ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-emerald-600" />
            <span>Nadpłata kapitału</span>
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] border border-indigo-200 flex items-center gap-1">
            <Landmark className="w-2.5 h-2.5 text-indigo-600" />
            <span>Rata regularna</span>
          </span>
        )}
      </div>

      {/* Główna kalkulacja salda: Przed ➔ Po wpłacie */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        {/* Kolumna lewa: porównanie sald */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-slate-500 text-[11px]">
            <span>Aktualne saldo długu:</span>
            <span className="font-semibold line-through text-slate-400">
              {initialRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Pozostanie do spłaty:
            </span>
            <div className="flex items-center space-x-1.5">
              <span
                className={`text-base sm:text-lg font-black tracking-tight ${
                  isOverpaid
                    ? 'text-rose-600'
                    : isFullySettled
                    ? 'text-emerald-600'
                    : 'text-indigo-950'
                }`}
              >
                {projectedRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-bold">{currency}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-emerald-600" />
              <span>Spadek salda kapitału:</span>
            </span>
            <span className="font-bold text-emerald-700">
              - {safePrincipal.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </span>
          </div>
        </div>

        {/* Kolumna prawa: struktura wpłaty kapitał vs odsetki */}
        <div className="p-2.5 rounded-xl bg-white/80 border border-indigo-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Struktura tej wpłaty:</span>
            <span className="font-bold text-slate-900">
              {(safeTotal > 0 ? safeTotal : safePrincipal + safeInterest).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </span>
          </div>

          {/* Dwukolorowy pasek podziału wpłaty */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, principalShare))}%` }}
              title={`Kapitał: ${safePrincipal.toFixed(2)} ${currency} (${principalShare.toFixed(0)}%)`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, interestShare))}%` }}
              title={`Odsetki: ${safeInterest.toFixed(2)} ${currency} (${interestShare.toFixed(0)}%)`}
            />
          </div>

          {/* Etykiety podziału */}
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex items-center space-x-1 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">
                Kapitał: <strong>{safePrincipal.toFixed(2)} {currency}</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1 text-amber-800 text-right justify-end">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="truncate">
                Odsetki: <strong>{safeInterest.toFixed(2)} {currency}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pasek postępu spłaty całego kredytu/zobowiązania */}
      <div className="mt-3 pt-2.5 border-t border-indigo-100/70 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>Postęp spłaty całkowitego zadłużenia:</span>
          <span className="font-semibold text-slate-800">
            {currentProgressPercent.toFixed(1)}% <ArrowRight className="w-3 h-3 inline mx-0.5 text-indigo-500" />{' '}
            <strong className="text-indigo-900">{projectedProgressPercent.toFixed(1)}%</strong>
            {progressDelta > 0.05 && (
              <span className="text-emerald-700 font-bold ml-1">
                (+{progressDelta.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>

        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, currentProgressPercent))}%` }}
          />
          {progressDelta > 0 && (
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100 - currentProgressPercent, progressDelta)}%` }}
            />
          )}
        </div>
      </div>

      {/* Komunikaty statusu / ostrzeżenia */}
      {isFullySettled && (
        <div className="mt-2.5 p-2 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 font-bold flex items-center space-x-2 text-[11px]">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>🎉 Ta wpłata całkowicie spłaci to zobowiązanie! Status zostanie oznaczony jako: Rozliczone.</span>
        </div>
      )}

      {isOverpaid && (
        <div className="mt-2.5 p-2 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-semibold flex items-center space-x-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>
            Uwaga: Kwota spłaty kapitału ({safePrincipal.toFixed(2)} {currency}) przewyższa aktualne saldo ({initialRemaining.toFixed(2)} {currency}) o {overpaidAmount.toFixed(2)} {currency}!
          </span>
        </div>
      )}

      {!isFullySettled && !isOverpaid && safePrincipal === 0 && safeInterest > 0 && (
        <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center space-x-2 text-[11px]">
          <Percent className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            Wpłata pokrywa wyłącznie odsetki/koszty. Saldo kapitału ({initialRemaining.toFixed(2)} {currency}) nie zostanie pomniejszone.
          </span>
        </div>
      )}
    </div>
  );
};
