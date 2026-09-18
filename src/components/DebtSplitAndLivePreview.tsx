import React from 'react';
import {
  Landmark,
  Zap,
  Clock,
  Percent,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { DebtItem } from '../types';
import { isInterestBearingDebt, calculateSuggestedLoanSplit } from '../utils/loanCalculation';

export interface DebtSplitAndLivePreviewProps {
  debt: DebtItem;
  paymentAmount: number;
  paymentDate?: string;
  paymentType: 'regular' | 'overpayment';
  onChangePaymentType: (type: 'regular' | 'overpayment') => void;
  principalAmount: string;
  onChangePrincipal: (val: string) => void;
  interestAmount: string;
  onChangeInterest: (val: string) => void;
  onSetExactAmount?: (amount: string) => void;
  excludeTransactionId?: string;
  className?: string;
}

export const DebtSplitAndLivePreview: React.FC<DebtSplitAndLivePreviewProps> = ({
  debt,
  paymentAmount,
  paymentDate,
  paymentType,
  onChangePaymentType,
  principalAmount,
  onChangePrincipal,
  interestAmount,
  onChangeInterest,
  onSetExactAmount,
  excludeTransactionId,
  className = '',
}) => {
  const parsedAmt = Math.max(0, isNaN(paymentAmount) ? 0 : paymentAmount);
  const hasInterest = isInterestBearingDebt(debt);

  // Jeśli transakcja jest aktualnie edytowana, odszukujemy jej dotychczasowy wkład kapitałowy w historii,
  // aby wykluczyć go z bieżącego salda i obliczać podgląd na żywo od czystej bazy wyjściowej sprzed tej wpłaty.
  const existingPayment = excludeTransactionId && debt.paymentsHistory
    ? debt.paymentsHistory.find((p) => p.transactionId === excludeTransactionId || p.id === excludeTransactionId)
    : null;

  const excludedPrincipal = existingPayment
    ? (existingPayment.principalAmount !== undefined ? existingPayment.principalAmount : existingPayment.amount)
    : 0;

  const totalAmount = debt.totalAmount || debt.initialAmount || (debt.currentRemaining || 0);
  const baseRemaining = Math.min(
    totalAmount,
    Math.max(0, (debt.currentRemaining || 0) + excludedPrincipal)
  );
  const basePaid = Math.max(0, (debt.paidAmount || (totalAmount - (debt.currentRemaining || 0))) - excludedPrincipal);

  // Zasilamy kalkulator odsetek bazowym saldem (sprzed edytowanej transakcji)
  const effectiveDebtForCalc: DebtItem = excludeTransactionId
    ? {
        ...debt,
        currentRemaining: baseRemaining,
      }
    : debt;

  const splitSuggestion = hasInterest
    ? calculateSuggestedLoanSplit({
        debt: effectiveDebtForCalc,
        paymentAmount: parsedAmt,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        paymentType,
      })
    : null;

  // Obliczenie części kapitałowej i odsetkowej (dla obu trybów: raty kredytu oraz nadpłaty)
  let safePrincipal: number;
  let safeInterest: number;

  if (principalAmount !== '') {
    safePrincipal = Math.max(0, parseFloat(principalAmount.replace(',', '.')) || 0);
    safeInterest = interestAmount !== ''
      ? Math.max(0, parseFloat(interestAmount.replace(',', '.')) || 0)
      : Math.max(0, Math.round((parsedAmt - safePrincipal) * 100) / 100);
  } else if (paymentType === 'overpayment') {
    safePrincipal = parsedAmt;
    safeInterest = 0;
  } else if (hasInterest && splitSuggestion) {
    safePrincipal = splitSuggestion.suggestedPrincipal;
    safeInterest = splitSuggestion.suggestedInterest;
  } else {
    safePrincipal = parsedAmt;
    safeInterest = 0;
  }

  const isOverpaid = baseRemaining > 0 && safePrincipal > baseRemaining + 0.009;
  const overpaidAmount = isOverpaid ? Math.round((safePrincipal - baseRemaining) * 100) / 100 : 0;
  const projectedRemaining = Math.max(0, Math.round((baseRemaining - safePrincipal) * 100) / 100);
  const isFinalInstallment = baseRemaining > 0 && projectedRemaining <= 0.009 && !isOverpaid;

  const projectedPaid = Math.round((basePaid + safePrincipal) * 100) / 100;
  const currentProgressPercent = totalAmount > 0 ? Math.min(100, Math.max(0, (basePaid / totalAmount) * 100)) : 0;
  const projectedProgressPercent = totalAmount > 0 ? Math.min(100, Math.max(0, (projectedPaid / totalAmount) * 100)) : 0;
  const progressDelta = Math.max(0, projectedProgressPercent - currentProgressPercent);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Ostrzeżenie o nadpłacie przekraczającej saldo */}
      {isOverpaid && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-950 animate-in fade-in">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="font-bold text-xs text-rose-900">
                Kwota przewyższa pozostałe saldo zadłużenia!
              </h4>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Do spłaty pozostało <strong>{baseRemaining.toFixed(2)} zł</strong>. Zadeklarowana część kapitałowa ({safePrincipal.toFixed(2)} zł) jest za duża o <strong>{overpaidAmount.toFixed(2)} zł</strong>.
              </p>
            </div>
          </div>
          {onSetExactAmount && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  onSetExactAmount(baseRemaining.toFixed(2));
                  if (hasInterest) {
                    onChangePrincipal(baseRemaining.toFixed(2));
                    onChangeInterest('0.00');
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-[11px] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ustaw dokładną kwotę spłaty ({baseRemaining.toFixed(2)} zł)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Komunikat o pełnym rozliczeniu */}
      {!isOverpaid && isFinalInstallment && (
        <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-1 text-emerald-950 animate-in fade-in shadow-2xs">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-xs text-emerald-900">
                🏁 Ostatnia rata / pełne rozliczenie
              </h4>
              <p className="text-[11px] text-emerald-800">
                Ta wpłata całkowicie zamknie i rozliczy pozycję w sekcji Zobowiązania.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Jedna minimalistyczna ramka: podział raty połączony z podglądem na żywo */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/30 border border-slate-200 space-y-3 shadow-2xs">
        {/* Nagłówek ramki: Saldo i ew. Oprocentowanie / Karencja */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {hasInterest ? 'Podział raty i stan zadłużenia' : 'Stan zadłużenia po wpłacie'}
            </span>
            <span className="text-[11px] text-slate-500">
              {excludeTransactionId ? 'Saldo bazowe (przed tą wpłatą): ' : 'Aktualne saldo: '}
              <strong className="text-slate-800">{baseRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</strong>
            </span>
          </div>

          {hasInterest && splitSuggestion && (
            splitSuggestion.isInGracePeriod ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-amber-700" />
                <span>Karencja do {splitSuggestion.graceEndDate || 'końca'}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 shrink-0">
                <Percent className="w-3 h-3 text-indigo-700" />
                <span>{splitSuggestion.effectiveAnnualRate}% rocznie</span>
              </span>
            )
          )}
        </div>

        {/* Przyciski typu spłaty dla kredytu odsetkowego */}
        {hasInterest && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                onChangePaymentType('regular');
                if (splitSuggestion) {
                  onChangePrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                  onChangeInterest(splitSuggestion.suggestedInterest.toFixed(2));
                }
              }}
              className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                paymentType !== 'overpayment'
                  ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Landmark className={`w-3.5 h-3.5 ${paymentType !== 'overpayment' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Rata kredytu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangePaymentType('overpayment');
                onChangePrincipal(parsedAmt.toFixed(2));
                onChangeInterest('0.00');
              }}
              className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                paymentType === 'overpayment'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${paymentType === 'overpayment' ? 'text-emerald-100' : 'text-slate-500'}`} />
              <span>Nadpłata</span>
            </button>
          </div>
        )}

        {/* Podział kwoty na kapitał i odsetki (dostępny w obu trybach) */}
        {hasInterest && (
          <div className="space-y-2.5">
            {paymentType === 'overpayment' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Podział nadpłaty
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangePrincipal(parsedAmt.toFixed(2));
                      onChangeInterest('0.00');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Domyślnie 100% kapitał ({parsedAmt.toFixed(2)} zł)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Spłata kapitału (zł):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={parsedAmt.toFixed(2)}
                      value={principalAmount}
                      onChange={(e) => {
                        const pVal = e.target.value;
                        onChangePrincipal(pVal);
                        const pNum = parseFloat(pVal) || 0;
                        onChangeInterest(Math.max(0, Math.round((parsedAmt - pNum) * 100) / 100).toFixed(2));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Odsetki / prowizja (zł):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={interestAmount}
                      onChange={(e) => {
                        const iVal = e.target.value;
                        onChangeInterest(iVal);
                        const iNum = parseFloat(iVal) || 0;
                        onChangePrincipal(Math.max(0, Math.round((parsedAmt - iNum) * 100) / 100).toFixed(2));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  💡 Nadpłata domyślnie w całości zmniejsza kapitał, ale możesz też wydzielić odsetki lub prowizję banku.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Dodatkowy przycisk: TYLKO sugestia banku (bez przycisków 100% kapitał / 100% odsetki) */}
                {splitSuggestion && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Podział raty
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onChangePrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                        onChangeInterest(splitSuggestion.suggestedInterest.toFixed(2));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Sugestia banku ({splitSuggestion.suggestedPrincipal.toFixed(2)} zł / {splitSuggestion.suggestedInterest.toFixed(2)} zł)</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Spłata kapitału (zł):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={principalAmount}
                      onChange={(e) => {
                        const pVal = e.target.value;
                        onChangePrincipal(pVal);
                        const pNum = parseFloat(pVal) || 0;
                        onChangeInterest(Math.max(0, Math.round((parsedAmt - pNum) * 100) / 100).toFixed(2));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Koszt odsetek (zł):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={interestAmount}
                      onChange={(e) => {
                        const iVal = e.target.value;
                        onChangeInterest(iVal);
                        const iNum = parseFloat(iVal) || 0;
                        onChangePrincipal(Math.max(0, Math.round((parsedAmt - iNum) * 100) / 100).toFixed(2));
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {splitSuggestion && (
                  <p className="text-[10px] text-indigo-700 leading-tight">
                    {splitSuggestion.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Połączony podgląd na żywo stanu zadłużenia */}
        <div className={`pt-2.5 space-y-2 ${hasInterest ? 'border-t border-slate-100' : ''}`}>
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">
                Pozostanie do spłaty:
              </span>
              <div className="flex items-baseline space-x-2">
                <span className={`text-base font-black tracking-tight ${
                  isOverpaid ? 'text-rose-600' : projectedRemaining <= 0.009 ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {projectedRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                </span>
                {safePrincipal > 0 && !isOverpaid && (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    (-{safePrincipal.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium block">
                Postęp spłaty:
              </span>
              <span className="text-xs font-bold text-slate-700">
                {projectedProgressPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Pasek postępu */}
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-slate-400 h-full transition-all duration-300"
              style={{ width: `${currentProgressPercent}%` }}
              title={`Spłacono wcześniej: ${currentProgressPercent.toFixed(1)}%`}
            />
            {progressDelta > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all duration-300 animate-pulse"
                style={{ width: `${progressDelta}%` }}
                title={`Ta wpłata: +${progressDelta.toFixed(1)}%`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
