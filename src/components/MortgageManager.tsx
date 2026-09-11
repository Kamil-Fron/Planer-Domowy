import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Plus,
  TrendingDown,
  Calendar,
  Percent,
  Clock,
  ShieldCheck,
  Calculator,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  PiggyBank,
  CheckCircle2,
  Info,
  DollarSign,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { MortgageLoan, MortgagePaymentRecord, Transaction } from '../types';

interface MortgageManagerProps {
  mortgages: MortgageLoan[];
  onUpdateMortgage: (updated: MortgageLoan) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  onDeleteTransaction?: (txId: string) => void;
  transactions?: Transaction[];
  onSuccessFeedback?: (
    title: string,
    amount: number,
    type: 'expense' | 'income' | 'shopping',
    onUndo?: () => void,
    subtitle?: string
  ) => void;
}

export const MortgageManager: React.FC<MortgageManagerProps> = ({
  mortgages,
  onUpdateMortgage,
  onAddTransaction,
  onDeleteTransaction,
  transactions = [],
  onSuccessFeedback,
}) => {
  // Current active loan (default to first or fallback)
  const loan = mortgages[0];

  // Helper to calculate end of grace period
  const calculateGraceEndDate = (startDateStr: string, months: number): string => {
    if (!startDateStr || !months || months <= 0) return '';
    try {
      const d = new Date(startDateStr);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // State for new loan creation form (when user has no loans)
  const [newLoanName, setNewLoanName] = useState('');
  const [newLoanBank, setNewLoanBank] = useState('');
  const [newLoanTotalAmount, setNewLoanTotalAmount] = useState('');
  const [newLoanRemainingPrincipal, setNewLoanRemainingPrincipal] = useState('');
  const [newLoanInitialPaid, setNewLoanInitialPaid] = useState('0');
  const [newLoanMonthlyPayment, setNewLoanMonthlyPayment] = useState('');
  const [newLoanInterestRate, setNewLoanInterestRate] = useState('');
  const [newLoanTermYears, setNewLoanTermYears] = useState('');
  const [newLoanStartDate, setNewLoanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLoanRepaymentStartDate, setNewLoanRepaymentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLoanGraceMonths, setNewLoanGraceMonths] = useState('0');
  const [newLoanGraceEndDate, setNewLoanGraceEndDate] = useState('');
  const [newLoanPaymentDay, setNewLoanPaymentDay] = useState('10');
  const [newLoanNotes, setNewLoanNotes] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'regular' | 'overpayment'>('regular');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTotalAmount, setPaymentTotalAmount] = useState('');
  const [paymentPrincipalAmount, setPaymentPrincipalAmount] = useState('');
  const [paymentInterestAmount, setPaymentInterestAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentIsGracePeriod, setPaymentIsGracePeriod] = useState(false);

  // In-app Delete Confirmation Modal (avoids window.confirm in iframe)
  const [paymentToDelete, setPaymentToDelete] = useState<MortgagePaymentRecord | null>(null);

  // Loan Edit Modal
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editRemainingPrincipal, setEditRemainingPrincipal] = useState('');
  const [editInitialPaid, setEditInitialPaid] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editTermYears, setEditTermYears] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editRepaymentStartDate, setEditRepaymentStartDate] = useState('');
  const [editGraceMonths, setEditGraceMonths] = useState('0');
  const [editGraceEndDate, setEditGraceEndDate] = useState('');
  const [editPaymentDay, setEditPaymentDay] = useState('10');
  const [editNotes, setEditNotes] = useState('');

  // Simulator State
  const [simMonthlyOverpayment, setSimMonthlyOverpayment] = useState(300);
  const [simOneTimeOverpayment, setSimOneTimeOverpayment] = useState(0);

  // Auto-calculate grace end date for new loan
  const handleNewGraceMonthsChange = (monthsStr: string) => {
    setNewLoanGraceMonths(monthsStr);
    const months = parseInt(monthsStr) || 0;
    if (months > 0 && newLoanStartDate) {
      setNewLoanGraceEndDate(calculateGraceEndDate(newLoanStartDate, months));
    } else {
      setNewLoanGraceEndDate('');
    }
  };

  // Auto-calculate grace end date for edit modal
  const handleEditGraceMonthsChange = (monthsStr: string) => {
    setEditGraceMonths(monthsStr);
    const months = parseInt(monthsStr) || 0;
    if (months > 0 && editStartDate) {
      setEditGraceEndDate(calculateGraceEndDate(editStartDate, months));
    } else {
      setEditGraceEndDate('');
    }
  };

  // Handle New Loan Submission (for fresh users)
  const handleCreateNewLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmt = parseFloat(newLoanTotalAmount);
    const remaining = parseFloat(newLoanRemainingPrincipal) || totalAmt;
    const initialPaid = parseFloat(newLoanInitialPaid) || 0;
    const monthlyPay = parseFloat(newLoanMonthlyPayment);
    const rate = parseFloat(newLoanInterestRate);
    const term = parseInt(newLoanTermYears) || 25;
    const graceMonths = parseInt(newLoanGraceMonths) || 0;

    if (isNaN(totalAmt) || totalAmt <= 0) return;

    const createdLoan: MortgageLoan = {
      id: `mortgage-${Date.now()}`,
      name: newLoanName.trim() || 'Kredyt hipoteczny',
      bankName: newLoanBank.trim() || 'Bank',
      totalLoanAmount: totalAmt,
      remainingPrincipal: remaining,
      initialPaidPrincipal: initialPaid,
      monthlyPayment: !isNaN(monthlyPay) && monthlyPay > 0 ? monthlyPay : 2500,
      interestRate: !isNaN(rate) && rate > 0 ? rate : 7.5,
      loanTermYears: term,
      startDate: newLoanStartDate || new Date().toISOString().split('T')[0],
      repaymentStartDate: newLoanRepaymentStartDate || newLoanStartDate,
      gracePeriodMonths: graceMonths,
      gracePeriodEndDate: newLoanGraceEndDate || (graceMonths > 0 ? calculateGraceEndDate(newLoanStartDate, graceMonths) : undefined),
      paymentDayOfMonth: parseInt(newLoanPaymentDay) || 10,
      rateType: 'equal',
      wiborOrMarginNotes: newLoanNotes.trim() || undefined,
      paymentsHistory: [],
      createdAt: new Date().toISOString(),
    };

    onUpdateMortgage(createdLoan);
    if (onSuccessFeedback) {
      onSuccessFeedback('Utworzono kredyt hipoteczny', totalAmt, 'expense', undefined, `Kredyt "${createdLoan.name}" został pomyślnie skonfigurowany.`);
    }
  };

  // Demo sample loader helper
  const handleLoadSampleLoan = () => {
    onUpdateMortgage({
      id: 'mortgage-sample-1',
      name: 'Kredyt hipoteczny - Mieszkanie',
      bankName: 'PKO Bank Polski',
      totalLoanAmount: 409000,
      remainingPrincipal: 403000,
      initialPaidPrincipal: 6000,
      monthlyPayment: 2800,
      interestRate: 7.45,
      loanTermYears: 29,
      startDate: '2024-01-10',
      repaymentStartDate: '2024-07-10',
      gracePeriodMonths: 6,
      gracePeriodEndDate: '2024-07-10',
      paymentDayOfMonth: 10,
      rateType: 'equal',
      wiborOrMarginNotes: 'WIBOR 3M + marża banku 1.65%',
      paymentsHistory: [
        {
          id: 'mp-hist-1',
          date: '2026-07-10',
          type: 'regular',
          totalAmount: 2800,
          principalAmount: 298.5,
          interestAmount: 2501.5,
          remainingPrincipalAfter: 403298.5,
          notes: 'Rata lipiec',
        },
        {
          id: 'mp-hist-2',
          date: '2026-08-10',
          type: 'regular',
          totalAmount: 2800,
          principalAmount: 298.5,
          interestAmount: 2501.5,
          remainingPrincipalAfter: 403000,
          notes: 'Rata sierpień',
        },
      ],
      createdAt: new Date().toISOString(),
    });
  };

  // If no loan registered yet, render clean empty configuration form
  if (!loan) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Skonfiguruj Kredyt Hipoteczny</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Wprowadź parametry swojego kredytu, aby kontrolować spłatę kapitału, odsetki, okres karencji oraz oszczędności z nadpłat.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleLoan}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              Wypełnij przykładowymi danymi (409 tys. zł / 29 lat)
            </button>
          </div>

          <form onSubmit={handleCreateNewLoan} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa kredytu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Kredyt hipoteczny - Mieszkanie"
                  value={newLoanName}
                  onChange={(e) => setNewLoanName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa banku</label>
                <input
                  type="text"
                  required
                  placeholder="np. PKO Bank Polski, mBank, ING..."
                  value={newLoanBank}
                  onChange={(e) => setNewLoanBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Całkowita kwota kredytu (PLN)</label>
                <input
                  type="number"
                  step="1000"
                  required
                  placeholder="np. 400000"
                  value={newLoanTotalAmount}
                  onChange={(e) => {
                    setNewLoanTotalAmount(e.target.value);
                    if (!newLoanRemainingPrincipal) {
                      setNewLoanRemainingPrincipal(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">Aktualny pozostały kapitał (PLN)</label>
                <input
                  type="number"
                  step="100"
                  required
                  placeholder="np. 395000"
                  value={newLoanRemainingPrincipal}
                  onChange={(e) => setNewLoanRemainingPrincipal(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-sm font-bold text-rose-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dotychczas spłacony kapitał (PLN)</label>
                <input
                  type="number"
                  step="100"
                  placeholder="np. 5000 (lub 0)"
                  value={newLoanInitialPaid}
                  onChange={(e) => setNewLoanInitialPaid(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rata miesięczna (PLN)</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="np. 2800"
                  value={newLoanMonthlyPayment}
                  onChange={(e) => setNewLoanMonthlyPayment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Oprocentowanie roczne (%)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="np. 7.45"
                  value={newLoanInterestRate}
                  onChange={(e) => setNewLoanInterestRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Okres kredytowania (lata)</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="np. 29"
                  value={newLoanTermYears}
                  onChange={(e) => setNewLoanTermYears(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Grace Period & Repayment Dates Section */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-center space-x-2 text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Terminy spłat & Okres karencji w spłacie kapitału
                </span>
              </div>
              <p className="text-xs text-amber-800">
                W okresie karencji (np. podczas budowy lub transzowania) rata składa się w 100% z odsetek bankowych, a kapitał nie jest pomniejszany.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">Data uruchomienia kredytu</label>
                  <input
                    type="date"
                    required
                    value={newLoanStartDate}
                    onChange={(e) => {
                      setNewLoanStartDate(e.target.value);
                      if (parseInt(newLoanGraceMonths) > 0) {
                        setNewLoanGraceEndDate(calculateGraceEndDate(e.target.value, parseInt(newLoanGraceMonths)));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">Data rozpoczęcia spłaty</label>
                  <input
                    type="date"
                    value={newLoanRepaymentStartDate}
                    onChange={(e) => setNewLoanRepaymentStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">Okres karencji (miesięcy)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    placeholder="0 jeśli brak"
                    value={newLoanGraceMonths}
                    onChange={(e) => handleNewGraceMonthsChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">Koniec karencji (data)</label>
                  <input
                    type="date"
                    value={newLoanGraceEndDate}
                    onChange={(e) => setNewLoanGraceEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dzień płatności raty (dzień miesiąca)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={newLoanPaymentDay}
                  onChange={(e) => setNewLoanPaymentDay(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notatki / WIBOR / Marża banku</label>
                <input
                  type="text"
                  placeholder="np. WIBOR 3M + marża 1.65%"
                  value={newLoanNotes}
                  onChange={(e) => setNewLoanNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Utwórz kredyt i rozpocznij monitorowanie</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Calculations for current loan
  const totalAmount = loan.totalLoanAmount || 409000;
  const remainingPrincipal = loan.remainingPrincipal || 403000;
  const initialPaid = loan.initialPaidPrincipal || 0;
  const historyPrincipalPaid = loan.paymentsHistory.reduce((sum, p) => sum + (p.principalAmount || 0), 0);
  const totalPaidPrincipal = initialPaid + historyPrincipalPaid;
  const paidPercent = totalAmount > 0 ? (totalPaidPrincipal / totalAmount) * 100 : 0;

  // Monthly breakdown approximation based on annual interest rate
  const annualRate = loan.interestRate || 7.45;
  const monthlyInterestRate = annualRate / 100 / 12;
  const calculatedCurrentInterest = remainingPrincipal * monthlyInterestRate;
  const calculatedCurrentPrincipal = Math.max(0, loan.monthlyPayment - calculatedCurrentInterest);

  // Check if current date or payment is in grace period
  const isDateInGrace = (dateStr: string): boolean => {
    if (loan.gracePeriodEndDate && dateStr <= loan.gracePeriodEndDate) return true;
    if (loan.gracePeriodMonths && loan.gracePeriodMonths > 0 && loan.startDate) {
      const graceEnd = calculateGraceEndDate(loan.startDate, loan.gracePeriodMonths);
      if (graceEnd && dateStr <= graceEnd) return true;
    }
    return false;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isCurrentlyInGrace = isDateInGrace(todayStr);

  // Total overpayments made
  const totalOverpayments = loan.paymentsHistory
    .filter((p) => p.type === 'overpayment')
    .reduce((sum, p) => sum + p.principalAmount, 0);

  // Estimated interest saved by overpayments (rough rule: overpaid amount * rate * remaining years / 2)
  const estimatedInterestSaved = totalOverpayments > 0
    ? totalOverpayments * (annualRate / 100) * (loan.loanTermYears * 0.45)
    : 0;

  // Prepare payment modal defaults
  const openPaymentModal = (type: 'regular' | 'overpayment') => {
    setPaymentType(type);
    const d = new Date().toISOString().split('T')[0];
    setPaymentDate(d);
    const inGrace = type === 'regular' && isDateInGrace(d);
    setPaymentIsGracePeriod(inGrace);

    if (type === 'regular') {
      const defaultTotal = loan.monthlyPayment;
      setPaymentTotalAmount(defaultTotal.toString());
      if (inGrace) {
        setPaymentInterestAmount(defaultTotal.toString());
        setPaymentPrincipalAmount('0');
        setPaymentNotes(`Rata kredytu - okres karencji (${new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })})`);
      } else {
        const interest = Math.round(calculatedCurrentInterest * 100) / 100;
        const principal = Math.round((defaultTotal - interest) * 100) / 100;
        setPaymentInterestAmount(interest.toString());
        setPaymentPrincipalAmount(principal.toString());
        setPaymentNotes(`Rata kredytu (${new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })})`);
      }
    } else {
      setPaymentTotalAmount('1000');
      setPaymentPrincipalAmount('1000');
      setPaymentInterestAmount('0');
      setPaymentNotes('Nadpłata kapitałowa');
    }
    setShowPaymentModal(true);
  };

  const handleTotalAmountChange = (val: string) => {
    setPaymentTotalAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (paymentType === 'regular') {
        if (paymentIsGracePeriod) {
          setPaymentPrincipalAmount('0');
          setPaymentInterestAmount(val);
        } else {
          const interest = Math.min(num, Math.round(calculatedCurrentInterest * 100) / 100);
          const principal = Math.max(0, Math.round((num - interest) * 100) / 100);
          setPaymentInterestAmount(interest.toString());
          setPaymentPrincipalAmount(principal.toString());
        }
      } else {
        // Overpayment is 100% principal
        setPaymentPrincipalAmount(val);
        setPaymentInterestAmount('0');
      }
    }
  };

  const handleGraceToggleChange = (checked: boolean) => {
    setPaymentIsGracePeriod(checked);
    const num = parseFloat(paymentTotalAmount) || loan.monthlyPayment;
    if (checked) {
      setPaymentPrincipalAmount('0');
      setPaymentInterestAmount(num.toString());
    } else {
      const interest = Math.min(num, Math.round(calculatedCurrentInterest * 100) / 100);
      const principal = Math.max(0, Math.round((num - interest) * 100) / 100);
      setPaymentInterestAmount(interest.toString());
      setPaymentPrincipalAmount(principal.toString());
    }
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmt = parseFloat(paymentTotalAmount);
    const principalAmt = paymentIsGracePeriod ? 0 : (parseFloat(paymentPrincipalAmount) || 0);
    const interestAmt = paymentIsGracePeriod ? totalAmt : (parseFloat(paymentInterestAmount) || 0);

    if (isNaN(totalAmt) || totalAmt <= 0) return;

    // New remaining principal cannot be below 0
    const newRemaining = Math.max(0, loan.remainingPrincipal - principalAmt);

    // Create unique IDs guaranteed to match between payment history and budget transactions
    const paymentRecordId = `mp-${Date.now()}`;
    const txId = `tx-mortgage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newPaymentRecord: MortgagePaymentRecord = {
      id: paymentRecordId,
      date: paymentDate,
      type: paymentType,
      totalAmount: totalAmt,
      principalAmount: principalAmt,
      interestAmount: interestAmt,
      remainingPrincipalAfter: newRemaining,
      notes: paymentNotes || (paymentType === 'overpayment' ? 'Nadpłata kredytu' : (paymentIsGracePeriod ? 'Rata w okresie karencji' : 'Rata miesięczna')),
      transactionId: txId,
      isGracePeriod: paymentIsGracePeriod,
    };

    // Update mortgage loan
    const updatedLoan: MortgageLoan = {
      ...loan,
      remainingPrincipal: newRemaining,
      paymentsHistory: [newPaymentRecord, ...loan.paymentsHistory],
    };
    onUpdateMortgage(updatedLoan);

    // Create budget transaction with matching ID so it seamlessly affects expenses & is fully linked
    onAddTransaction({
      id: txId,
      amount: totalAmt,
      type: 'expense',
      category: 'Kredyty i pożyczki',
      date: paymentDate,
      title: paymentType === 'overpayment' ? 'Nadpłata kredytu hipotecznego' : (paymentIsGracePeriod ? 'Rata kredytu (okres karencji)' : 'Rata kredytu hipotecznego'),
      comment: paymentIsGracePeriod
        ? `Okres karencji (100% odsetki): ${interestAmt.toFixed(2)} zł | Kapitał: 0.00 zł`
        : `Kapitał: ${principalAmt.toFixed(2)} zł | Odsetki: ${interestAmt.toFixed(2)} zł | Pozostało: ${newRemaining.toFixed(2)} zł`,
      mortgageId: loan.id,
      mortgagePaymentType: paymentType,
      principalAmount: principalAmt,
      interestAmount: interestAmt,
    });

    if (onSuccessFeedback) {
      onSuccessFeedback(
        paymentType === 'overpayment' ? 'Nadpłata kredytu' : (paymentIsGracePeriod ? 'Rata kredytu (karencja)' : 'Rata kredytu'),
        totalAmt,
        'expense',
        undefined,
        paymentIsGracePeriod
          ? 'Okres karencji: cała kwota zaliczona na poczet odsetek. Saldo kapitału bez zmian.'
          : `Kapitał pomniejszony o ${principalAmt.toFixed(2)} zł. Pozostało: ${newRemaining.toLocaleString('pl-PL')} zł`
      );
    }

    setShowPaymentModal(false);
  };

  // Open Edit Loan Modal
  const openEditLoanModal = () => {
    setEditName(loan.name);
    setEditBankName(loan.bankName);
    setEditTotalAmount(loan.totalLoanAmount.toString());
    setEditRemainingPrincipal(loan.remainingPrincipal.toString());
    setEditInitialPaid(loan.initialPaidPrincipal.toString());
    setEditMonthlyPayment(loan.monthlyPayment.toString());
    setEditInterestRate(loan.interestRate.toString());
    setEditTermYears(loan.loanTermYears.toString());
    setEditStartDate(loan.startDate || '');
    setEditRepaymentStartDate(loan.repaymentStartDate || loan.startDate || '');
    setEditGraceMonths((loan.gracePeriodMonths || 0).toString());
    setEditGraceEndDate(loan.gracePeriodEndDate || '');
    setEditPaymentDay(loan.paymentDayOfMonth.toString());
    setEditNotes(loan.wiborOrMarginNotes || '');
    setShowEditLoanModal(true);
  };

  const handleSaveLoanSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const graceM = parseInt(editGraceMonths) || 0;
    const updated: MortgageLoan = {
      ...loan,
      name: editName.trim() || 'Kredyt hipoteczny',
      bankName: editBankName.trim() || 'Bank',
      totalLoanAmount: parseFloat(editTotalAmount) || loan.totalLoanAmount,
      remainingPrincipal: parseFloat(editRemainingPrincipal) || loan.remainingPrincipal,
      initialPaidPrincipal: parseFloat(editInitialPaid) || 0,
      monthlyPayment: parseFloat(editMonthlyPayment) || loan.monthlyPayment,
      interestRate: parseFloat(editInterestRate) || loan.interestRate,
      loanTermYears: parseInt(editTermYears) || loan.loanTermYears,
      startDate: editStartDate || loan.startDate,
      repaymentStartDate: editRepaymentStartDate || loan.repaymentStartDate,
      gracePeriodMonths: graceM,
      gracePeriodEndDate: editGraceEndDate || (graceM > 0 ? calculateGraceEndDate(editStartDate, graceM) : undefined),
      paymentDayOfMonth: parseInt(editPaymentDay) || 10,
      wiborOrMarginNotes: editNotes.trim(),
    };
    onUpdateMortgage(updated);
    setShowEditLoanModal(false);
  };

  // In-app Confirmation Delete Handler (Never blocked by iframe sandbox)
  const handleConfirmDeletePayment = () => {
    if (!paymentToDelete) return;
    const record = paymentToDelete;
    const restoredPrincipal = loan.remainingPrincipal + (record.principalAmount || 0);
    const updatedHistory = loan.paymentsHistory.filter((p) => p.id !== record.id);

    const updated: MortgageLoan = {
      ...loan,
      remainingPrincipal: restoredPrincipal,
      paymentsHistory: updatedHistory,
    };
    onUpdateMortgage(updated);

    // Locate linked transaction in budget transactions
    let targetTxId = record.transactionId;
    if (!targetTxId && transactions.length > 0) {
      const match = transactions.find(
        (t) =>
          (t.mortgageId === loan.id || t.title.toLowerCase().includes('kredyt')) &&
          t.date === record.date &&
          Math.abs(t.amount - record.totalAmount) < 0.05
      );
      if (match) targetTxId = match.id;
    }

    if (targetTxId && onDeleteTransaction) {
      onDeleteTransaction(targetTxId);
    }

    if (onSuccessFeedback) {
      onSuccessFeedback(
        'Usunięto spłatę kredytu',
        record.totalAmount,
        'expense',
        undefined,
        `Przywrócono kapitał (${record.principalAmount.toFixed(2)} zł) oraz usunięto wpis z budżetu domowego.`
      );
    }

    setPaymentToDelete(null);
  };

  // Simulator Calculation
  const simulationResults = useMemo(() => {
    const P = Math.max(1000, remainingPrincipal - simOneTimeOverpayment);
    const r = annualRate / 100 / 12;
    const standardPayment = loan.monthlyPayment;

    // Standard remaining months: n = -ln(1 - P*r/R) / ln(1+r)
    let standardMonths = 0;
    try {
      if (standardPayment > P * r) {
        standardMonths = Math.ceil(-Math.log(1 - (P * r) / standardPayment) / Math.log(1 + r));
      } else {
        standardMonths = loan.loanTermYears * 12;
      }
    } catch {
      standardMonths = loan.loanTermYears * 12;
    }

    // Accelerated payment
    const acceleratedPayment = standardPayment + simMonthlyOverpayment;
    let acceleratedMonths = 0;
    try {
      if (acceleratedPayment > P * r) {
        acceleratedMonths = Math.ceil(-Math.log(1 - (P * r) / acceleratedPayment) / Math.log(1 + r));
      } else {
        acceleratedMonths = standardMonths;
      }
    } catch {
      acceleratedMonths = standardMonths;
    }

    const monthsSaved = Math.max(0, standardMonths - acceleratedMonths);
    const yearsSaved = (monthsSaved / 12).toFixed(1);

    // Approximate total interest comparison
    const standardTotalInterest = Math.max(0, standardMonths * standardPayment - P);
    const acceleratedTotalInterest = Math.max(0, acceleratedMonths * acceleratedPayment - P);
    const totalInterestSaved = Math.max(0, standardTotalInterest - acceleratedTotalInterest);

    return {
      standardMonths,
      acceleratedMonths,
      monthsSaved,
      yearsSaved,
      totalInterestSaved: Math.round(totalInterestSaved),
    };
  }, [remainingPrincipal, annualRate, loan.monthlyPayment, loan.loanTermYears, simMonthlyOverpayment, simOneTimeOverpayment]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Banner Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Landmark className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white">{loan.name}</h1>
                  <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full font-bold border border-indigo-400/30">
                    {loan.bankName}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Termin raty: każdego <strong className="text-slate-200">{loan.paymentDayOfMonth}.</strong> dnia miesiąca • {loan.wiborOrMarginNotes || 'Oprocentowanie zmienne'}
                </p>
              </div>
            </div>

            {/* Grace Period Active Badge if applicable */}
            {isCurrentlyInGrace && (
              <div className="inline-flex items-center space-x-2 mt-2 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Okres karencji aktywny (do {loan.gracePeriodEndDate || 'końca karencji'}) – 100% raty idzie na odsetki
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={() => openPaymentModal('regular')}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Zarejestruj ratę ({loan.monthlyPayment.toFixed(0)} zł)</span>
            </button>

            <button
              onClick={() => openPaymentModal('overpayment')}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-950/40 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <TrendingDown className="w-4 h-4" />
              <span>+ Nadpłać kredyt</span>
            </button>

            <button
              onClick={openEditLoanModal}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              title="Edytuj parametry kredytu (kwota, bank, okres, oprocentowanie, karencja)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ustawienia</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Pozostały kapitał
            </span>
            <p className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
              {remainingPrincipal.toLocaleString('pl-PL')} <span className="text-xs font-bold text-slate-400">PLN</span>
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              z kwoty początkowej {totalAmount.toLocaleString('pl-PL')} zł
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Spłacony kapitał
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
              {totalPaidPrincipal.toLocaleString('pl-PL')} <span className="text-xs font-bold text-slate-400">PLN</span>
            </p>
            <span className="text-[10px] text-emerald-300/80 mt-0.5 block">
              {paidPercent.toFixed(1)}% całości długu
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Wysokość raty
            </span>
            <p className="text-xl sm:text-2xl font-black text-white mt-1">
              {loan.monthlyPayment.toLocaleString('pl-PL')} <span className="text-xs font-bold text-slate-400">PLN</span>
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {isCurrentlyInGrace
                ? 'Karencja: 100% odsetki (0 zł kapitału)'
                : `Kapitał: ~${calculatedCurrentPrincipal.toFixed(0)} zł | Odsetki: ~${calculatedCurrentInterest.toFixed(0)} zł`}
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Oprocentowanie
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
              {loan.interestRate}% <span className="text-xs font-bold text-slate-400">w skali roku</span>
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Okres: {loan.loanTermYears} lat
            </span>
          </div>
        </div>

        {/* Repayment Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Postęp spłaty kapitału: {paidPercent.toFixed(1)}%</span>
            </span>
            <span className="text-slate-400">
              Spłacono: {totalPaidPrincipal.toLocaleString('pl-PL')} zł • Zostało: {remainingPrincipal.toLocaleString('pl-PL')} zł
            </span>
          </div>
          <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(1, paidPercent))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid: Simulator & Current Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Overpayment Simulator */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Calculator className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-base text-slate-900">Symulator Nadpłat Kredytu</h3>
                <p className="text-xs text-slate-500">
                  Zobacz, jak regularna lub jednorazowa nadpłata skraca okres spłaty i obniża odsetki.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              Kalkulator Korzyści
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Slider: Monthly overpayment */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Stała comiesięczna nadpłata</label>
                <span className="text-sm font-black text-indigo-600">+{simMonthlyOverpayment} zł</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={simMonthlyOverpayment}
                onChange={(e) => setSimMonthlyOverpayment(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 zł</span>
                <span>+1 000 zł</span>
                <span>+3 000 zł</span>
              </div>
            </div>

            {/* Slider: One-time overpayment */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Jednorazowa wpłata teraz</label>
                <span className="text-sm font-black text-emerald-600">+{simOneTimeOverpayment} zł</span>
              </div>
              <input
                type="range"
                min="0"
                max="50000"
                step="1000"
                value={simOneTimeOverpayment}
                onChange={(e) => setSimOneTimeOverpayment(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 zł</span>
                <span>+25 000 zł</span>
                <span>+50 000 zł</span>
              </div>
            </div>
          </div>

          {/* Results Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                Zaoszczędzony czas
              </span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {simulationResults.yearsSaved} <span className="text-xs font-bold">lat</span>
              </p>
              <span className="text-[11px] text-emerald-800 mt-0.5 block">
                ({simulationResults.monthsSaved} miesięcy mniej spłaty)
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                Zaoszczędzone odsetki
              </span>
              <p className="text-2xl font-black text-indigo-700 mt-1">
                ~{simulationResults.totalInterestSaved.toLocaleString('pl-PL')} <span className="text-xs font-bold">zł</span>
              </p>
              <span className="text-[11px] text-indigo-800 mt-0.5 block">
                Pieniądze zaoszczędzone na marży banku
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                Nowy okres spłaty
              </span>
              <p className="text-2xl font-black text-amber-800 mt-1">
                {(simulationResults.acceleratedMonths / 12).toFixed(1)} <span className="text-xs font-bold">lat</span>
              </p>
              <span className="text-[11px] text-amber-800 mt-0.5 block">
                zamiast {(simulationResults.standardMonths / 12).toFixed(1)} lat
              </span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Current Monthly Payment Structure & Grace Period */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Percent className="w-4 h-4 text-indigo-600" />
            <span>Struktura najbliższej raty</span>
          </h3>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Pełna kwota raty:</span>
              <span className="text-base font-black text-slate-900">{loan.monthlyPayment.toFixed(2)} zł</span>
            </div>

            {isCurrentlyInGrace ? (
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-950 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Okres karencji aktywny</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    W okresie karencji (do {loan.gracePeriodEndDate || 'zakończenia'}) 100% raty idzie na odsetki.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold">Część kapitałowa:</span>
                  <span className="font-bold text-emerald-700">0.00 zł</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-700 font-bold">Część odsetkowa:</span>
                  <span className="font-bold text-rose-700">{loan.monthlyPayment.toFixed(2)} zł</span>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-bold flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Część kapitałowa:</span>
                    </span>
                    <span className="font-bold text-emerald-700">+{calculatedCurrentPrincipal.toFixed(2)} zł</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tylko ta część realnie zmniejsza Twój dług w banku.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-rose-700 font-bold flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Część odsetkowa:</span>
                    </span>
                    <span className="font-bold text-rose-700">-{calculatedCurrentInterest.toFixed(2)} zł</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Koszt banku ({loan.interestRate}% rocznie od salda zadłużenia).
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-2xl text-xs text-indigo-900 flex items-start space-x-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Z każdą kolejną ratą kapitałową udział spłacanego długu rośnie. Nadpłata natychmiast obniża przyszłe koszty odsetek!
            </span>
          </div>
        </div>
      </div>

      {/* History of Payments & Overpayments */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900">Historia Spłat & Nadpłat ({loan.paymentsHistory.length})</h3>
              <p className="text-xs text-slate-500">
                Zarejestrowane wpłaty rat oraz nadpłaty pomniejszające kapitał kredytu.
              </p>
            </div>
          </div>

          <button
            onClick={() => openPaymentModal('regular')}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dodaj wpis</span>
          </button>
        </div>

        {loan.paymentsHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Brak zarejestrowanych spłat. Kliknij „Zarejestruj ratę”, aby odnotować bieżącą płatność.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-2">Data</th>
                  <th className="py-2.5 px-2">Typ</th>
                  <th className="py-2.5 px-2">Łączna wpłata</th>
                  <th className="py-2.5 px-2 text-emerald-700">Część kapitałowa</th>
                  <th className="py-2.5 px-2 text-rose-700">Część odsetkowa</th>
                  <th className="py-2.5 px-2">Saldo po spłacie</th>
                  <th className="py-2.5 px-2">Opis</th>
                  <th className="py-2.5 px-2 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.paymentsHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2 font-bold text-slate-800">{item.date}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.type === 'overpayment'
                            ? 'bg-indigo-100 text-indigo-800'
                            : item.isGracePeriod
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.type === 'overpayment' ? 'Nadpłata' : item.isGracePeriod ? 'Karencja' : 'Rata miesięczna'}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-black text-slate-900">{item.totalAmount.toFixed(2)} zł</td>
                    <td className="py-3 px-2 font-bold text-emerald-600">
                      +{item.principalAmount.toFixed(2)} zł
                    </td>
                    <td className="py-3 px-2 font-medium text-rose-600">
                      {item.interestAmount > 0 ? `-${item.interestAmount.toFixed(2)} zł` : '0.00 zł'}
                    </td>
                    <td className="py-3 px-2 font-semibold text-slate-700">
                      {item.remainingPrincipalAfter.toLocaleString('pl-PL')} zł
                    </td>
                    <td className="py-3 px-2 text-slate-500 max-w-[200px] truncate">{item.notes || '-'}</td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => setPaymentToDelete(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Usuń spłatę z historii i powiązaną transakcję z budżetu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: REGISTER PAYMENT / OVERPAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  {paymentType === 'overpayment' ? <TrendingDown className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {paymentType === 'overpayment' ? 'Rejestracja Nadpłaty Kredytu' : 'Rejestracja Raty Kredytu'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Wpis automatycznie zaktualizuje saldo kredytu i doda wydatek do budżetu.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => openPaymentModal('regular')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    paymentType === 'regular'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rata miesięczna
                </button>
                <button
                  type="button"
                  onClick={() => openPaymentModal('overpayment')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    paymentType === 'overpayment'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nadpłata kapitałowa
                </button>
              </div>

              {/* Grace Period Switcher for Regular Payment */}
              {paymentType === 'regular' && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                      <span>Okres karencji (100% odsetek)</span>
                    </span>
                    <p className="text-[11px] text-amber-800">
                      W okresie karencji całość wpłaty idzie na odsetki – kapitał nie ulega zmniejszeniu.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={paymentIsGracePeriod}
                    onChange={(e) => handleGraceToggleChange(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 cursor-pointer rounded shrink-0"
                  />
                </div>
              )}

              {/* Date & Total Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data wpłaty</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => {
                      setPaymentDate(e.target.value);
                      if (paymentType === 'regular') {
                        const inGrace = isDateInGrace(e.target.value);
                        handleGraceToggleChange(inGrace);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Łączna kwota (PLN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentTotalAmount}
                    onChange={(e) => handleTotalAmountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Capital & Interest Split */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Podział raty (kapitał vs odsetki)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                      Część kapitałowa (zmniejsza dług):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={paymentIsGracePeriod}
                      required
                      value={paymentPrincipalAmount}
                      onChange={(e) => setPaymentPrincipalAmount(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-bold ${
                        paymentIsGracePeriod
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white border-emerald-300 text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-700 mb-1">
                      Część odsetkowa (koszt banku):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={paymentIsGracePeriod}
                      value={paymentInterestAmount}
                      onChange={(e) => setPaymentInterestAmount(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-bold ${
                        paymentIsGracePeriod
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-white border-rose-200 text-rose-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notatka / Opis</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="np. Rata za wrzesień, nadpłata z premii..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Zapisz spłatę ({parseFloat(paymentTotalAmount || '0').toFixed(2)} zł)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LOAN PARAMETERS */}
      {showEditLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Pencil className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Ustawienia Kredytu Hipotecznego</h3>
                  <p className="text-xs text-slate-500">Dostosuj parametry umowy kredytowej, karencji i salda.</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditLoanModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLoanSettings} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nazwa kredytu</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank</label>
                  <input
                    type="text"
                    required
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Całkowita kwota kredytu (PLN)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={editTotalAmount}
                    onChange={(e) => setEditTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">
                    Pozostały kapitał do spłaty (PLN)
                  </label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={editRemainingPrincipal}
                    onChange={(e) => setEditRemainingPrincipal(e.target.value)}
                    className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rata miesięczna</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={editMonthlyPayment}
                    onChange={(e) => setEditMonthlyPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Oprocentowanie %</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editInterestRate}
                    onChange={(e) => setEditInterestRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Okres (lata)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={editTermYears}
                    onChange={(e) => setEditTermYears(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Grace Period & Repayment Dates */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Terminy spłat & Karencja kapitałowa
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-0.5">Uruchomienie kredytu</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-0.5">Rozpoczęcie spłaty</label>
                    <input
                      type="date"
                      value={editRepaymentStartDate}
                      onChange={(e) => setEditRepaymentStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-0.5">Karencja (miesiące)</label>
                    <input
                      type="number"
                      min="0"
                      value={editGraceMonths}
                      onChange={(e) => handleEditGraceMonthsChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-0.5">Koniec karencji</label>
                    <input
                      type="date"
                      value={editGraceEndDate}
                      onChange={(e) => setEditGraceEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dzień płatności raty</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={editPaymentDay}
                    onChange={(e) => setEditPaymentDay(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Spłacono wcześniej (PLN)</label>
                  <input
                    type="number"
                    step="100"
                    value={editInitialPaid}
                    onChange={(e) => setEditInitialPaid(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WIBOR / Marża / Notatki</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="np. WIBOR 3M + 1.65% marża banku"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditLoanModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: CONFIRM PAYMENT DELETION */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Usuń wpis spłaty kredytu</h3>
                <p className="text-xs text-slate-500">Operacja przywróci saldo kapitału i usunie transakcję z budżetu.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Data spłaty:</span>
                <strong className="text-slate-900">{paymentToDelete.date}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Łączna kwota:</span>
                <strong className="text-slate-900">{paymentToDelete.totalAmount.toFixed(2)} zł</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Zwracany kapitał do salda:</span>
                <strong className="text-emerald-700">+{paymentToDelete.principalAmount.toFixed(2)} zł</strong>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                Powiązany wydatek w historii transakcji i statystykach budżetu domowego również zostanie automatycznie usunięty.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePayment}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-200 flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Potwierdź usunięcie</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
