import React, { useState, useMemo } from 'react';
import {
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  Calendar,
  Percent,
  Clock,
  Landmark,
  HandCoins,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calculator,
  FileText,
  User,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  PiggyBank,
  Check,
  X,
  Sparkles,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { DebtItem, DebtPaymentRecord, DebtType, DebtCategory, Transaction, Bill } from '../types';
import {
  calculateSuggestedLoanSplit,
  isInterestBearingDebt,
  getLoanEffectiveInterestRate,
  isDebtInGracePeriod,
} from '../utils/loanCalculation';

interface DebtManagerProps {
  debts: DebtItem[];
  onAddDebt: (debt: DebtItem) => void;
  onUpdateDebt: (debt: DebtItem) => void;
  onDeleteDebt: (debtId: string) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  onDeleteTransaction?: (txId: string) => void;
  onAddBill?: (bill: Omit<Bill, 'id' | 'createdAt'> & { id?: string }) => void;
  transactions?: Transaction[];
  onSuccessFeedback?: (
    title: string,
    amount: number,
    type: 'expense' | 'income' | 'shopping',
    onUndo?: () => void,
    subtitle?: string
  ) => void;
}

export const DebtManager: React.FC<DebtManagerProps> = ({
  debts,
  onAddDebt,
  onUpdateDebt,
  onDeleteDebt,
  onAddTransaction,
  onAddBill,
  transactions = [],
  onSuccessFeedback,
}) => {
  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'borrowed' | 'lent' | 'bank' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<DebtItem | null>(null);
  const [selectedDebtForDetails, setSelectedDebtForDetails] = useState<DebtItem | null>(null);
  const [selectedDebtForEdit, setSelectedDebtForEdit] = useState<DebtItem | null>(null);
  const [selectedDebtForCalculator, setSelectedDebtForCalculator] = useState<DebtItem | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<DebtItem | null>(null);

  // Quick Payment Modal form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'regular' | 'overpayment' | 'settlement'>('regular');
  const [paymentPrincipal, setPaymentPrincipal] = useState('');
  const [paymentInterest, setPaymentInterest] = useState('');

  // Add Debt Form State
  const [formType, setFormType] = useState<DebtType>('borrowed');
  const [formCategory, setFormCategory] = useState<DebtCategory>('pozyczka_prywatna');
  const [formName, setFormName] = useState('');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formInitialAmount, setFormInitialAmount] = useState('');
  const [formCurrentPaid, setFormCurrentPaid] = useState('0');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCreateTransaction, setFormCreateTransaction] = useState(true);

  // Bill creation form state for debts
  const [formCreateBill, setFormCreateBill] = useState(false);
  const [formBillName, setFormBillName] = useState('');
  const [formBillAmount, setFormBillAmount] = useState('');
  const [formBillDueDate, setFormBillDueDate] = useState('');
  const [formBillBillingCycle, setFormBillBillingCycle] = useState<'miesięcznie' | 'co 2 miesiące' | 'kwartalnie' | 'rocznie' | 'jednorazowo'>('miesięcznie');
  const [formBillProvider, setFormBillProvider] = useState('');

  // Bank loan extra fields (expanded mortgage settings)
  const [formBankName, setFormBankName] = useState('');
  const [formLoanAccountNumber, setFormLoanAccountNumber] = useState('');
  const [formMonthlyPayment, setFormMonthlyPayment] = useState('');
  const [formInterestRate, setFormInterestRate] = useState('');
  const [formMarginRate, setFormMarginRate] = useState('');
  const [formReferenceRate, setFormReferenceRate] = useState('');
  const [formReferenceRateType, setFormReferenceRateType] = useState('WIBOR 3M');
  const [formLoanTermYears, setFormLoanTermYears] = useState('');
  const [formPaymentDayOfMonth, setFormPaymentDayOfMonth] = useState('10');
  const [formGracePeriodMonths, setFormGracePeriodMonths] = useState('0');
  const [formGracePeriodEndDate, setFormGracePeriodEndDate] = useState('');
  const [formRateType, setFormRateType] = useState<'equal' | 'decreasing'>('equal');
  const [formInsuranceMonthly, setFormInsuranceMonthly] = useState('');
  const [formOverpaymentCommission, setFormOverpaymentCommission] = useState('');
  const [formOverpaymentCommissionYears, setFormOverpaymentCommissionYears] = useState('');
  const [formWiborOrMarginNotes, setFormWiborOrMarginNotes] = useState('');

  // Edit Debt Modal Form State
  const [editName, setEditName] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editType, setEditType] = useState<DebtType>('borrowed');
  const [editCategory, setEditCategory] = useState<DebtCategory>('pozyczka_prywatna');
  const [editInitialAmount, setEditInitialAmount] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'settled'>('active');

  // Edit Mortgage fields
  const [editBankName, setEditBankName] = useState('');
  const [editLoanAccountNumber, setEditLoanAccountNumber] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editMarginRate, setEditMarginRate] = useState('');
  const [editReferenceRate, setEditReferenceRate] = useState('');
  const [editReferenceRateType, setEditReferenceRateType] = useState('WIBOR 3M');
  const [editLoanTermYears, setEditLoanTermYears] = useState('');
  const [editPaymentDayOfMonth, setEditPaymentDayOfMonth] = useState('10');
  const [editGracePeriodMonths, setEditGracePeriodMonths] = useState('0');
  const [editGracePeriodEndDate, setEditGracePeriodEndDate] = useState('');
  const [editRateType, setEditRateType] = useState<'equal' | 'decreasing'>('equal');
  const [editInsuranceMonthly, setEditInsuranceMonthly] = useState('');
  const [editOverpaymentCommission, setEditOverpaymentCommission] = useState('');
  const [editOverpaymentCommissionYears, setEditOverpaymentCommissionYears] = useState('');
  const [editWiborOrMarginNotes, setEditWiborOrMarginNotes] = useState('');

  // Overpayment simulator state for bank loans
  const [simulatorOverpayment, setSimulatorOverpayment] = useState('500');

  // Filtered debts
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (filterType === 'borrowed' && (d.type !== 'borrowed' || d.status === 'settled')) return false;
      if (filterType === 'lent' && (d.type !== 'lent' || d.status === 'settled')) return false;
      if (filterType === 'bank' && (!d.isBankLoan || d.status === 'settled')) return false;
      if (filterType === 'settled' && d.status !== 'settled') return false;
      if (filterType === 'all' && d.status === 'settled') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchCounterparty = d.counterparty.toLowerCase().includes(q);
        const matchNotes = d.notes?.toLowerCase().includes(q);
        return matchName || matchCounterparty || matchNotes;
      }
      return true;
    });
  }, [debts, filterType, searchQuery]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let totalBorrowedInitial = 0;
    let totalBorrowedRemaining = 0;
    let totalBorrowedPaid = 0;
    let activeBorrowedCount = 0;

    let totalLentInitial = 0;
    let totalLentRemaining = 0;
    let totalLentPaid = 0;
    let activeLentCount = 0;

    debts.forEach((d) => {
      if (d.type === 'borrowed') {
        totalBorrowedInitial += d.initialAmount;
        totalBorrowedRemaining += d.currentRemaining;
        totalBorrowedPaid += d.paidAmount;
        if (d.status === 'active') activeBorrowedCount++;
      } else {
        totalLentInitial += d.initialAmount;
        totalLentRemaining += d.currentRemaining;
        totalLentPaid += d.paidAmount;
        if (d.status === 'active') activeLentCount++;
      }
    });

    const netBalance = totalLentRemaining - totalBorrowedRemaining;

    return {
      totalBorrowedInitial,
      totalBorrowedRemaining,
      totalBorrowedPaid,
      activeBorrowedCount,
      totalLentInitial,
      totalLentRemaining,
      totalLentPaid,
      activeLentCount,
      netBalance,
    };
  }, [debts]);

  // Reset Add Form
  const resetForm = (targetCategory?: DebtCategory) => {
    const cat = targetCategory || 'pozyczka_prywatna';
    setFormType('borrowed');
    setFormCategory(cat);
    setFormName('');
    setFormCounterparty('');
    setFormInitialAmount('');
    setFormCurrentPaid('0');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormDueDate('');
    setFormNotes('');
    // Kredyty bankowe/hipoteczne domyślnie bez transakcji przychodu (wypłata bezpośrednia do zbywcy), inne domyślnie z transakcją
    setFormCreateTransaction(cat !== 'kredyt_bankowy');
    // Kredyty bankowe domyślnie z utworzeniem rachunku raty
    setFormCreateBill(cat === 'kredyt_bankowy');
    setFormBillName('');
    setFormBillAmount('');
    setFormBillDueDate('');
    setFormBillBillingCycle('miesięcznie');
    setFormBillProvider('');
    setFormBankName('');
    setFormLoanAccountNumber('');
    setFormMonthlyPayment('');
    setFormInterestRate('');
    setFormMarginRate('');
    setFormReferenceRate('');
    setFormReferenceRateType('WIBOR 3M');
    setFormLoanTermYears('');
    setFormPaymentDayOfMonth('10');
    setFormGracePeriodMonths('0');
    setFormGracePeriodEndDate('');
    setFormRateType('equal');
    setFormInsuranceMonthly('');
    setFormOverpaymentCommission('');
    setFormOverpaymentCommissionYears('');
    setFormWiborOrMarginNotes('');
  };

  // Open Edit Modal
  const handleOpenEditModal = (debt: DebtItem) => {
    setSelectedDebtForEdit(debt);
    setEditName(debt.name);
    setEditCounterparty(debt.counterparty);
    setEditType(debt.type);
    setEditCategory(debt.category);
    setEditInitialAmount(debt.initialAmount.toString());
    setEditPaidAmount(debt.paidAmount.toString());
    setEditStartDate(debt.startDate);
    setEditDueDate(debt.dueDate || '');
    setEditNotes(debt.notes || '');
    setEditStatus(debt.status);

    // Bank loan / mortgage fields
    setEditBankName(debt.bankName || (debt.isBankLoan ? debt.counterparty : ''));
    setEditLoanAccountNumber(debt.loanAccountNumber || '');
    setEditMonthlyPayment(debt.monthlyPayment ? debt.monthlyPayment.toString() : '');
    setEditInterestRate(debt.interestRate ? debt.interestRate.toString() : '');
    setEditMarginRate(debt.marginRate ? debt.marginRate.toString() : '');
    setEditReferenceRate(debt.referenceRate ? debt.referenceRate.toString() : '');
    setEditReferenceRateType(debt.referenceRateType || 'WIBOR 3M');
    setEditLoanTermYears(debt.loanTermYears ? debt.loanTermYears.toString() : '');
    setEditPaymentDayOfMonth(debt.paymentDayOfMonth ? debt.paymentDayOfMonth.toString() : '10');
    setEditGracePeriodMonths(debt.gracePeriodMonths ? debt.gracePeriodMonths.toString() : '0');
    setEditGracePeriodEndDate(debt.gracePeriodEndDate || '');
    setEditRateType(debt.rateType || 'equal');
    setEditInsuranceMonthly(debt.insuranceMonthly ? debt.insuranceMonthly.toString() : '');
    setEditOverpaymentCommission(
      debt.overpaymentCommission !== undefined ? debt.overpaymentCommission.toString() : ''
    );
    setEditOverpaymentCommissionYears(
      debt.overpaymentCommissionYears ? debt.overpaymentCommissionYears.toString() : ''
    );
    setEditWiborOrMarginNotes(debt.wiborOrMarginNotes || '');
  };

  // Save Edit Debt
  const handleSaveEditDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtForEdit) return;

    const initAmount = parseFloat(editInitialAmount.replace(',', '.'));
    if (isNaN(initAmount) || initAmount <= 0) {
      alert('Wpisz poprawną kwotę całkowitą zadłużenia.');
      return;
    }
    const paid = parseFloat((editPaidAmount || '0').replace(',', '.')) || 0;
    const remaining = Math.max(0, initAmount - paid);
    const isBank = editCategory === 'kredyt_bankowy';

    const updatedDebt: DebtItem = {
      ...selectedDebtForEdit,
      name: editName.trim(),
      counterparty: editCounterparty.trim(),
      type: editType,
      category: editCategory,
      initialAmount: initAmount,
      paidAmount: paid,
      currentRemaining: remaining,
      startDate: editStartDate,
      dueDate: editDueDate || undefined,
      status: editStatus === 'settled' || remaining <= 0 ? 'settled' : 'active',
      notes: editNotes.trim() || undefined,
      isBankLoan: isBank,
      bankName: isBank ? editBankName.trim() || undefined : undefined,
      loanAccountNumber: isBank ? editLoanAccountNumber.trim() || undefined : undefined,
      monthlyPayment: isBank && editMonthlyPayment ? parseFloat(editMonthlyPayment.replace(',', '.')) : undefined,
      interestRate: isBank && editInterestRate ? parseFloat(editInterestRate.replace(',', '.')) : undefined,
      marginRate: isBank && editMarginRate ? parseFloat(editMarginRate.replace(',', '.')) : undefined,
      referenceRate: isBank && editReferenceRate ? parseFloat(editReferenceRate.replace(',', '.')) : undefined,
      referenceRateType: isBank ? editReferenceRateType : undefined,
      loanTermYears: isBank && editLoanTermYears ? parseFloat(editLoanTermYears) : undefined,
      paymentDayOfMonth: isBank && editPaymentDayOfMonth ? parseInt(editPaymentDayOfMonth, 10) : undefined,
      gracePeriodMonths: isBank && editGracePeriodMonths ? parseInt(editGracePeriodMonths, 10) : undefined,
      gracePeriodEndDate: isBank && editGracePeriodEndDate ? editGracePeriodEndDate : undefined,
      rateType: isBank ? editRateType : undefined,
      insuranceMonthly: isBank && editInsuranceMonthly ? parseFloat(editInsuranceMonthly.replace(',', '.')) : undefined,
      overpaymentCommission:
        isBank && editOverpaymentCommission ? parseFloat(editOverpaymentCommission.replace(',', '.')) : undefined,
      overpaymentCommissionYears:
        isBank && editOverpaymentCommissionYears ? parseInt(editOverpaymentCommissionYears, 10) : undefined,
      wiborOrMarginNotes: isBank && editWiborOrMarginNotes ? editWiborOrMarginNotes.trim() : undefined,
      updatedAt: new Date().toISOString(),
    };

    onUpdateDebt(updatedDebt);

    if (onSuccessFeedback) {
      onSuccessFeedback(
        updatedDebt.name,
        remaining,
        updatedDebt.type === 'borrowed' ? 'expense' : 'income',
        undefined,
        'Zaktualizowano dane zobowiązania'
      );
    }

    setSelectedDebtForEdit(null);
  };

  // Handle Add Debt Submit
  const handleSaveNewDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const initAmount = parseFloat(formInitialAmount.replace(',', '.'));
    if (isNaN(initAmount) || initAmount <= 0) {
      alert('Wpisz poprawną kwotę zadłużenia.');
      return;
    }
    const paidAlready = parseFloat((formCurrentPaid || '0').replace(',', '.')) || 0;
    const remaining = Math.max(0, initAmount - paidAlready);

    const isBank = formCategory === 'kredyt_bankowy';
    const newDebt: DebtItem = {
      id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: formType,
      category: formCategory,
      name: formName.trim() || (isBank ? 'Kredyt bankowy' : formType === 'borrowed' ? 'Pożyczka' : 'Pożyczka komuś'),
      counterparty: formCounterparty.trim() || (isBank ? (formBankName.trim() || 'Bank') : formType === 'borrowed' ? 'Wierzyciel' : 'Dłużnik'),
      initialAmount: initAmount,
      currentRemaining: remaining,
      paidAmount: paidAlready,
      startDate: formStartDate,
      dueDate: formDueDate || undefined,
      status: remaining <= 0 ? 'settled' : 'active',
      notes: formNotes.trim() || undefined,
      isBankLoan: isBank,
      bankName: isBank ? (formBankName.trim() || formCounterparty.trim() || undefined) : undefined,
      loanAccountNumber: isBank && formLoanAccountNumber ? formLoanAccountNumber.trim() : undefined,
      monthlyPayment: isBank && formMonthlyPayment ? parseFloat(formMonthlyPayment.replace(',', '.')) : undefined,
      interestRate: isBank && formInterestRate ? parseFloat(formInterestRate.replace(',', '.')) : undefined,
      marginRate: isBank && formMarginRate ? parseFloat(formMarginRate.replace(',', '.')) : undefined,
      referenceRate: isBank && formReferenceRate ? parseFloat(formReferenceRate.replace(',', '.')) : undefined,
      referenceRateType: isBank ? formReferenceRateType : undefined,
      loanTermYears: isBank && formLoanTermYears ? parseFloat(formLoanTermYears) : undefined,
      paymentDayOfMonth: isBank ? parseInt(formPaymentDayOfMonth, 10) || 10 : undefined,
      gracePeriodMonths: isBank ? parseInt(formGracePeriodMonths, 10) || 0 : undefined,
      gracePeriodEndDate: isBank && formGracePeriodEndDate ? formGracePeriodEndDate : undefined,
      rateType: isBank ? formRateType : undefined,
      insuranceMonthly: isBank && formInsuranceMonthly ? parseFloat(formInsuranceMonthly.replace(',', '.')) : undefined,
      overpaymentCommission: isBank && formOverpaymentCommission ? parseFloat(formOverpaymentCommission.replace(',', '.')) : undefined,
      overpaymentCommissionYears: isBank && formOverpaymentCommissionYears ? parseInt(formOverpaymentCommissionYears, 10) : undefined,
      wiborOrMarginNotes: isBank && formWiborOrMarginNotes ? formWiborOrMarginNotes.trim() : undefined,
      paymentsHistory: [],
      createdAt: new Date().toISOString(),
    };

    onAddDebt(newDebt);

    // Opcjonalna rejestracja początkowej transakcji w budżecie (z możliwością wyłączenia, np. dla kredytów hipotecznych)
    if (formCreateTransaction && initAmount > 0) {
      if (formType === 'borrowed') {
        // Wpływ gotówki z zaciągnięcia długu do budżetu
        onAddTransaction({
          title: `Zaciągnięcie zobowiązania: ${newDebt.name}`,
          amount: initAmount,
          type: 'income',
          category: 'Zobowiązania i pożyczki',
          date: formStartDate,
          debtId: newDebt.id,
          debtAction: 'borrow',
          debtCounterparty: newDebt.counterparty,
          comment: `Otrzymano środki z: ${newDebt.counterparty}`,
        });
      } else {
        // Wydatek gotówki pożyczonej komuś
        onAddTransaction({
          title: `Udzielenie pożyczki: ${newDebt.name}`,
          amount: initAmount,
          type: 'expense',
          category: 'Zobowiązania i pożyczki',
          date: formStartDate,
          debtId: newDebt.id,
          debtAction: 'lend',
          debtCounterparty: newDebt.counterparty,
          comment: `Pożyczono dla: ${newDebt.counterparty}`,
        });
      }
    }

    // Opcjonalne utworzenie powiązanego rachunku w sekcji Rachunki
    if (formCreateBill && onAddBill) {
      const parsedBillAmount =
        parseFloat((formBillAmount || '').replace(',', '.')) ||
        (newDebt.monthlyPayment || newDebt.initialAmount);

      if (parsedBillAmount > 0) {
        const calculatedDueDate =
          formBillDueDate ||
          formDueDate ||
          newDebt.startDate ||
          new Date().toISOString().split('T')[0];

        onAddBill({
          name: formBillName.trim() || (isBank ? `Rata: ${newDebt.name}` : `Rachunek: ${newDebt.name}`),
          serviceType: isBank ? 'kredyt' : 'inne',
          provider: formBillProvider.trim() || newDebt.counterparty || (isBank ? 'Bank' : 'Wierzyciel'),
          amount: parsedBillAmount,
          dueDate: calculatedDueDate,
          billingCycle: formBillBillingCycle,
          pricingType: 'fixed',
          status: 'pending',
          debtId: newDebt.id, // Powiązanie rachunku z utworzonym zadłużeniem!
          notes: `Rachunek powiązany ze zobowiązaniem: ${newDebt.name}`,
        });
      }
    }

    if (onSuccessFeedback) {
      const notesArr: string[] = [];
      if (formCreateBill) notesArr.push('utworzono powiązany rachunek');
      if (formCreateTransaction) notesArr.push('zaksięgowano w transakcjach');
      else notesArr.push('bez wpisu w transakcjach');

      onSuccessFeedback(
        newDebt.name,
        initAmount,
        formType === 'borrowed' ? 'income' : 'expense',
        undefined,
        `Zapisano zadłużenie (${notesArr.join(', ')})`
      );
    }

    setIsAddModalOpen(false);
    resetForm();
  };

  // Open Quick Payment Modal
  const handleOpenPayment = (debt: DebtItem) => {
    setSelectedDebtForPayment(debt);
    const defAmt = debt.monthlyPayment && debt.monthlyPayment <= debt.currentRemaining
      ? debt.monthlyPayment
      : debt.currentRemaining;
    const defAmtStr = defAmt > 0 ? defAmt.toFixed(2) : '';
    const today = new Date().toISOString().split('T')[0];
    const hasInterest = isInterestBearingDebt(debt);

    setPaymentAmount(defAmtStr);
    setPaymentDate(today);
    setPaymentNotes('');
    setPaymentType(hasInterest ? 'regular' : 'settlement');

    if (hasInterest && defAmt > 0) {
      const split = calculateSuggestedLoanSplit({
        debt,
        paymentAmount: defAmt,
        paymentDate: today,
        paymentType: 'regular',
      });
      setPaymentPrincipal(split.suggestedPrincipal.toFixed(2));
      setPaymentInterest(split.suggestedInterest.toFixed(2));
    } else {
      setPaymentPrincipal(defAmtStr);
      setPaymentInterest('0.00');
    }
  };

  // Submit Quick Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtForPayment) return;

    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      alert('Wprowadź prawidłową kwotę płatności.');
      return;
    }

    let principal = amount;
    let interest: number | undefined = undefined;

    const hasInterest = isInterestBearingDebt(selectedDebtForPayment);
    if (hasInterest && paymentPrincipal !== '') {
      const p = parseFloat(paymentPrincipal.replace(',', '.'));
      if (!isNaN(p) && p >= 0) {
        principal = p;
        interest = Math.max(0, Math.round((amount - p) * 100) / 100);
      }
    }

    if (principal > selectedDebtForPayment.currentRemaining + 0.009) {
      const overpaid = principal - selectedDebtForPayment.currentRemaining;
      alert(`Kwota spłaty kapitału (${principal.toFixed(2)} zł) przekracza pozostałe saldo zadłużenia (${selectedDebtForPayment.currentRemaining.toFixed(2)} zł) o ${overpaid.toFixed(2)} zł. Skoryguj kwotę przed zatwierdzeniem.`);
      return;
    }

    const newRemaining = Math.max(0, selectedDebtForPayment.currentRemaining - principal);
    const newPaid = selectedDebtForPayment.paidAmount + principal;

    const paymentRecord: DebtPaymentRecord = {
      id: `debt-pay-${Date.now()}`,
      date: paymentDate,
      amount,
      type: paymentType,
      principalAmount: principal,
      interestAmount: interest,
      remainingAfter: newRemaining,
      notes: paymentNotes.trim() || undefined,
    };

    // Create automatic transaction in Transactions
    const isRepayMyDebt = selectedDebtForPayment.type === 'borrowed';
    const txType = isRepayMyDebt ? 'expense' : 'income';
    const txTitle = isRepayMyDebt
      ? `Spłata zobowiązania: ${selectedDebtForPayment.name}`
      : `Zwrot pożyczki od: ${selectedDebtForPayment.counterparty}`;

    onAddTransaction({
      title: txTitle,
      amount,
      type: txType,
      category: 'Zobowiązania i pożyczki',
      date: paymentDate,
      debtId: selectedDebtForPayment.id,
      debtAction: isRepayMyDebt ? 'repay_borrowed' : 'receive_lent',
      debtCounterparty: selectedDebtForPayment.counterparty,
      comment: paymentNotes.trim() || `Rozliczenie w sekcji Zadłużenia`,
      principalAmount: principal,
      interestAmount: interest,
    });

    const updatedDebt: DebtItem = {
      ...selectedDebtForPayment,
      currentRemaining: newRemaining,
      paidAmount: newPaid,
      status: newRemaining <= 0 ? 'settled' : 'active',
      paymentsHistory: [paymentRecord, ...(selectedDebtForPayment.paymentsHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    onUpdateDebt(updatedDebt);

    if (onSuccessFeedback) {
      onSuccessFeedback(
        txTitle,
        amount,
        txType,
        undefined,
        newRemaining <= 0 ? '🎉 Zobowiązanie zostało całkowicie spłacone!' : `Pozostało: ${newRemaining.toLocaleString('pl-PL')} zł`
      );
    }

    setSelectedDebtForPayment(null);
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (debtToDelete) {
      onDeleteDebt(debtToDelete.id);
      setDebtToDelete(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-xs border border-indigo-400/20">
              <Scale className="w-3.5 h-3.5" />
              <span>Centrum Zarządzania Zobowiązaniami</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Zadłużenia, Kredyty i Pożyczki
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Śledź swoje długi do spłaty (kredyty bankowe, pożyczki od rodziny) oraz pieniądze pożyczone innym.
              Rozliczaj wpłaty i zwroty bezpośrednio z transakcji w budżecie.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Dodaj zadłużenie</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Overview Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Moje długi (Muszę oddać) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs uppercase tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Muszę oddać (Moje długi)</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {stats.totalBorrowedRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <TrendingDown className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Zaciągnięto: <span className="font-semibold text-slate-800">{stats.totalBorrowedInitial.toLocaleString('pl-PL')} zł</span>
            </div>
            <div>
              Spłacono: <span className="font-semibold text-emerald-600">{stats.totalBorrowedPaid.toLocaleString('pl-PL')} zł</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {stats.activeBorrowedCount} aktywnych zobowiązań
          </div>
        </div>

        {/* Card 2: Pożyczone innym (Do odzyskania) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Do odzyskania (Pożyczone innym)</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {stats.totalLentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Pożyczono: <span className="font-semibold text-slate-800">{stats.totalLentInitial.toLocaleString('pl-PL')} zł</span>
            </div>
            <div>
              Odzyskano: <span className="font-semibold text-emerald-600">{stats.totalLentPaid.toLocaleString('pl-PL')} zł</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {stats.activeLentCount} osób jest mi dłużnych
          </div>
        </div>

        {/* Card 3: Bilans Netto */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700 font-bold text-xs uppercase tracking-wider mb-1">
                <Scale className="w-3.5 h-3.5" />
                <span>Bilans zobowiązań netto</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-black tracking-tight ${
                stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {stats.netBalance >= 0 ? '+' : ''}{stats.netBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <HandCoins className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
            {stats.netBalance >= 0 ? (
              <span className="text-emerald-700 font-medium">
                Więcej masz do odzyskania niż do oddania! Bilans na Twoją korzyść.
              </span>
            ) : (
              <span className="text-rose-700 font-medium">
                Więcej musisz oddać niż masz do odzyskania.
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Łącznie pozycji w rejestrze: {debts.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Aktywne ({debts.filter(d => d.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterType('borrowed')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 flex items-center space-x-1.5 ${
              filterType === 'borrowed'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Muszę oddać ({stats.activeBorrowedCount})</span>
          </button>
          <button
            onClick={() => setFilterType('lent')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 flex items-center space-x-1.5 ${
              filterType === 'lent'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Do odzyskania ({stats.activeLentCount})</span>
          </button>
          <button
            onClick={() => setFilterType('bank')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 flex items-center space-x-1.5 ${
              filterType === 'bank'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Kredyty bankowe</span>
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
              filterType === 'settled'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Spłacone / Rozliczone ({debts.filter(d => d.status === 'settled').length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Szukaj po nazwie lub osobie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Debts List */}
      {filteredDebts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Scale className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Brak zarejestrowanych zadłużeń</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Nie znaleziono pozycji w tej kategorii. Dodaj swoje pierwsze zobowiązanie, kredyt lub pożyczkę, aby mieć pełną kontrolę nad budżetem.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Dodaj zadłużenie</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredDebts.map((item) => {
            const isBorrowed = item.type === 'borrowed';
            const isPaid = item.status === 'settled' || item.status === 'paid' || item.currentRemaining <= 0;
            const progress = item.initialAmount > 0
              ? Math.min(100, Math.round((item.paidAmount / item.initialAmount) * 100))
              : 0;

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {/* Direction Top Strip Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                        isBorrowed
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isBorrowed ? (
                        <>
                          <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Muszę oddać</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Do odzyskania</span>
                        </>
                      )}
                    </span>

                    {item.isBankLoan && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                        <Landmark className="w-3 h-3" />
                        <span>Kredyt bankowy</span>
                      </span>
                    )}

                    {isPaid && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>Spłacone</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      title="Edytuj zobowiązanie"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedDebtForDetails(item)}
                      title="Szczegóły i historia"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {item.isBankLoan && (
                      <button
                        onClick={() => setSelectedDebtForCalculator(item)}
                        title="Kalkulator i symulacja rat"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDebtToDelete(item)}
                      title="Usuń wpis"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Title & Counterparty */}
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {item.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isBorrowed ? 'Wierzyciel:' : 'Dłużnik:'}</span>
                    <span className="font-bold text-slate-700">{item.counterparty}</span>
                  </div>
                </div>

                {/* Amounts & Progress Bar */}
                <div className="my-5 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {isBorrowed ? 'Pozostało do spłaty:' : 'Pozostało do zwrotu:'}
                    </span>
                    <span className={`text-xl font-black ${isBorrowed ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {item.currentRemaining.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isBorrowed ? 'bg-indigo-600' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Spłacono: {item.paidAmount.toLocaleString('pl-PL')} zł ({progress}%)</span>
                      <span>Całość: {item.initialAmount.toLocaleString('pl-PL')} zł</span>
                    </div>
                  </div>

                  {/* Extra info pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Od: {item.startDate}</span>
                    </span>
                    {item.dueDate && (
                      <span className="flex items-center space-x-1 font-semibold text-indigo-700">
                        <Clock className="w-3 h-3" />
                        <span>Termin: {item.dueDate}</span>
                      </span>
                    )}
                    {item.monthlyPayment && (
                      <span className={`flex items-center space-x-1 font-semibold ${isPaid ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md' : 'text-slate-700'}`}>
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        <span>{isPaid ? 'Rata: Rozliczona (0 zł)' : `Rata: ${item.monthlyPayment.toLocaleString('pl-PL')} zł/msc`}</span>
                      </span>
                    )}
                    {item.interestRate && (
                      <span className="flex items-center space-x-1 font-medium text-slate-600">
                        <Percent className="w-3 h-3 text-slate-400" />
                        <span>Oproc: {item.interestRate}%</span>
                      </span>
                    )}
                    {item.marginRate && (
                      <span className="flex items-center space-x-1 font-medium text-slate-600">
                        <span>Marża: {item.marginRate}%</span>
                      </span>
                    )}
                    {item.referenceRateType && (
                      <span className="flex items-center space-x-1 font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                        <span>{item.referenceRateType}{item.referenceRate ? ` (${item.referenceRate}%)` : ''}</span>
                      </span>
                    )}
                    {item.insuranceMonthly && (
                      <span className="flex items-center space-x-1 font-medium text-slate-600">
                        <ShieldCheck className="w-3 h-3 text-slate-400" />
                        <span>Ubezp: {item.insuranceMonthly} zł/msc</span>
                      </span>
                    )}
                    {item.rateType && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {item.rateType === 'decreasing' ? 'Raty malejące' : 'Raty równe'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes if any */}
                {item.notes && (
                  <p className="text-xs text-slate-500 italic mb-4 line-clamp-2">
                    "{item.notes}"
                  </p>
                )}

                {/* Bottom Action Button */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedDebtForDetails(item)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-3 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
                  >
                    Historia ({item.paymentsHistory?.length || 0})
                  </button>

                  {item.status === 'active' ? (
                    <button
                      onClick={() => handleOpenPayment(item)}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white shadow-xs transition-all active:scale-95 ${
                        isBorrowed
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isBorrowed ? 'Spłać ratę / dług' : 'Zarejestruj zwrot'}</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Rozliczone w 100%</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: DODAJ NOWE ZADŁUŻENIE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Header (sticky at top) */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Nowe zadłużenie / pożyczka
                  </h2>
                  <p className="text-xs text-slate-500">
                    Wprowadź pożyczkę od kogoś lub pieniądze pożyczone innej osobie
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewDebt} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Krok 1: Wybór kierunku (Duże kafelki) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Kierunek zobowiązania:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('borrowed');
                      if (formCategory === 'inne') setFormCategory('pozyczka_prywatna');
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      formType === 'borrowed'
                        ? 'border-rose-500 bg-rose-50/50 text-rose-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <ArrowDownRight className={`w-4 h-4 ${formType === 'borrowed' ? 'text-rose-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs">Muszę oddać</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ja pożyczam od kogoś lub biorę kredyt w banku.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('lent');
                      if (formCategory === 'kredyt_bankowy') setFormCategory('pozyczka_prywatna');
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      formType === 'lent'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <ArrowUpRight className={`w-4 h-4 ${formType === 'lent' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs">Do odzyskania</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ja pożyczyłem komuś pieniądze i ma mi oddać.
                    </p>
                  </button>
                </div>
              </div>

              {/* Kategoria */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Kategoria:</label>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    const newCat = e.target.value as DebtCategory;
                    setFormCategory(newCat);
                    if (newCat === 'kredyt_bankowy') {
                      setFormCreateTransaction(false);
                      setFormCreateBill(true);
                      setFormBillBillingCycle('miesięcznie');
                    } else {
                      setFormCreateTransaction(true);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                >
                  {formType === 'borrowed' && (
                    <option value="kredyt_bankowy">Kredyt bankowy / hipoteczny</option>
                  )}
                  <option value="pozyczka_prywatna">Pożyczka prywatna / znajomy</option>
                  <option value="pozyczka_rodzina">Pożyczka rodzinna</option>
                  <option value="chwilowka">Pożyczka gotówkowa / ratalna</option>
                  <option value="inne">Inne zobowiązanie</option>
                </select>
              </div>

              {/* Nazwa i Osoba/Bank */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nazwa zadłużenia:</label>
                  <input
                    type="text"
                    required
                    placeholder={formType === 'borrowed' ? 'np. Kredyt na mieszkanie' : 'np. Pożyczka dla Marka'}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {formType === 'borrowed' ? 'Wierzyciel (kto pożyczył):' : 'Dłużnik (komu pożyczono):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={formType === 'borrowed' ? 'np. PKO BP lub Tata' : 'np. Marek Kowalski'}
                    value={formCounterparty}
                    onChange={(e) => setFormCounterparty(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Kwoty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Całkowita kwota pożyczki (zł):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formInitialAmount}
                    onChange={(e) => setFormInitialAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Spłacono już wcześniej (zł):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formCurrentPaid}
                    onChange={(e) => setFormCurrentPaid(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Daty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Data zaciągnięcia / pożyczenia:</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Planowany termin zwrotu (opcjonalnie):</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Parametry bankowe jeśli kredyt bankowy */}
              {formCategory === 'kredyt_bankowy' && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3.5">
                  <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <span>Zaawansowane parametry kredytu hipotecznego / bankowego</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Nazwa banku:</label>
                      <input
                        type="text"
                        placeholder="np. PKO BP, mBank, Santander, ING"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Numer konta do spłaty raty:</label>
                      <input
                        type="text"
                        placeholder="np. 00 1020 0000 0000..."
                        value={formLoanAccountNumber}
                        onChange={(e) => setFormLoanAccountNumber(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Rata miesięczna (zł):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 2850.00"
                        value={formMonthlyPayment}
                        onChange={(e) => setFormMonthlyPayment(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Typ rat:</label>
                      <select
                        value={formRateType}
                        onChange={(e) => setFormRateType(e.target.value as 'equal' | 'decreasing')}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="equal">Równe (annuitetowe)</option>
                        <option value="decreasing">Malejące</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Okres (lata):</label>
                      <input
                        type="number"
                        placeholder="np. 25"
                        value={formLoanTermYears}
                        onChange={(e) => setFormLoanTermYears(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Oprocentowanie całk. (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 7.45"
                        value={formInterestRate}
                        onChange={(e) => setFormInterestRate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Marża banku (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 1.85"
                        value={formMarginRate}
                        onChange={(e) => setFormMarginRate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Wskaźnik bazowy:</label>
                      <select
                        value={formReferenceRateType}
                        onChange={(e) => setFormReferenceRateType(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="WIBOR 3M">WIBOR 3M</option>
                        <option value="WIBOR 6M">WIBOR 6M</option>
                        <option value="WIRON">WIRON</option>
                        <option value="Stała stopa">Stała stopa</option>
                        <option value="Inne">Inne</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Dzień spłaty w msc:</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="np. 10"
                        value={formPaymentDayOfMonth}
                        onChange={(e) => setFormPaymentDayOfMonth(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Ubezpieczenia (zł/msc):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 120.00"
                        value={formInsuranceMonthly}
                        onChange={(e) => setFormInsuranceMonthly(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Karencja (miesięcy):</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formGracePeriodMonths}
                        onChange={(e) => setFormGracePeriodMonths(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Prowizja za nadpłatę (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 2.0 (jeśli obowiązuje)"
                        value={formOverpaymentCommission}
                        onChange={(e) => setFormOverpaymentCommission(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Przez ile pierwszych lat prowizja:</label>
                      <input
                        type="number"
                        placeholder="np. 3 lata"
                        value={formOverpaymentCommissionYears}
                        onChange={(e) => setFormOverpaymentCommissionYears(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notatki */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notatki / ustalenia:</label>
                <textarea
                  rows={2}
                  placeholder="np. Ustalono spłatę w 2 transzach, bez odsetek..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Opcja 1: Rejestracja początkowego wpisu w transakcjach (Budżecie) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        formCreateTransaction
                          ? formType === 'borrowed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <label
                        htmlFor="formCreateTransactionCheckbox"
                        className="font-bold text-xs text-slate-900 cursor-pointer block select-none"
                      >
                        {formType === 'borrowed'
                          ? 'Zarejestruj wpływ środków w transakcjach (przychód w budżecie)'
                          : 'Zarejestruj pożyczenie środków w transakcjach (wydatek w budżecie)'}
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {formCategory === 'kredyt_bankowy'
                          ? 'Wypłata kredytu hipotecznego/bankowego zazwyczaj trafia bezpośrednio do zbywcy lub dewelopera. Możesz wyłączyć tę opcję, aby nie zawyżać sztucznie przychodów w miesięcznym budżecie.'
                          : formType === 'borrowed'
                          ? 'Dodaje transakcję wpływu środków do kategorii „Zobowiązania i pożyczki” z datą zaciągnięcia długu.'
                          : 'Dodaje transakcję wyjściową pożyczonych środków w kategorii „Zobowiązania i pożyczki”.'}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      id="formCreateTransactionCheckbox"
                      type="checkbox"
                      checked={formCreateTransaction}
                      onChange={(e) => setFormCreateTransaction(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formCreateTransaction && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-medium text-slate-600">
                    <span>Kwota rejestrowana w budżecie:</span>
                    <span className="font-bold text-slate-900">
                      {(parseFloat(formInitialAmount.replace(',', '.')) || 0).toLocaleString('pl-PL', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      zł
                    </span>
                  </div>
                )}
              </div>

              {/* Opcja 2: Utworzenie powiązanego rachunku w sekcji Rachunki */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  formCreateBill
                    ? 'bg-indigo-50/70 border-indigo-200'
                    : 'bg-slate-50 border-slate-200'
                } space-y-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        formCreateBill ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <label
                        htmlFor="formCreateBillCheckbox"
                        className="font-bold text-xs text-indigo-950 cursor-pointer block select-none"
                      >
                        Utwórz powiązany rachunek w sekcji Rachunki
                      </label>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Automatycznie utworzy cykliczny rachunek (np. ratę kredytu). Każde opłacenie tego rachunku w sekcji „Rachunki” automatycznie zmniejszy kapitał i saldo tego zobowiązania!
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      id="formCreateBillCheckbox"
                      type="checkbox"
                      checked={formCreateBill}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormCreateBill(checked);
                        if (checked) {
                          if (!formBillName) {
                            setFormBillName(formName ? `Rata: ${formName}` : 'Rata zobowiązania');
                          }
                          if (!formBillAmount) {
                            setFormBillAmount(formMonthlyPayment || formInitialAmount || '');
                          }
                          if (!formBillDueDate) {
                            setFormBillDueDate(formDueDate || formStartDate || new Date().toISOString().split('T')[0]);
                          }
                          if (!formBillProvider) {
                            setFormBillProvider(formBankName || formCounterparty || '');
                          }
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formCreateBill && (
                  <div className="pt-3 border-t border-indigo-200/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Nazwa rachunku:
                        </label>
                        <input
                          type="text"
                          placeholder={formName ? `Rata: ${formName}` : 'np. Rata kredytu hipotecznego'}
                          value={formBillName}
                          onChange={(e) => setFormBillName(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Kwota płatności rachunku (zł):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={formMonthlyPayment || formInitialAmount || '0.00'}
                          value={formBillAmount}
                          onChange={(e) => setFormBillAmount(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Cykl płatności:
                        </label>
                        <select
                          value={formBillBillingCycle}
                          onChange={(e) =>
                            setFormBillBillingCycle(
                              e.target.value as 'miesięcznie' | 'co 2 miesiące' | 'kwartalnie' | 'rocznie' | 'jednorazowo'
                            )
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none cursor-pointer"
                        >
                          <option value="miesięcznie">Miesięcznie</option>
                          <option value="co 2 miesiące">Co 2 miesiące</option>
                          <option value="kwartalnie">Kwartalnie</option>
                          <option value="rocznie">Rocznie</option>
                          <option value="jednorazowo">Jednorazowo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Pierwszy termin płatności:
                        </label>
                        <input
                          type="date"
                          value={formBillDueDate}
                          onChange={(e) => setFormBillDueDate(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Odbiorca / Wierzyciel:
                        </label>
                        <input
                          type="text"
                          placeholder={formBankName || formCounterparty || 'np. PKO BP'}
                          value={formBillProvider}
                          onChange={(e) => setFormBillProvider(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-indigo-100/70 text-[11px] text-indigo-900 flex items-center space-x-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        Rachunek pojawi się w widoku <strong>Rachunki</strong> ze statusem „Do zapłaty” i bezpośrednim powiązaniem z tym zobowiązaniem.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              </div>

              {/* Modal buttons (sticky footer) */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0 bg-slate-50/80 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  Zapisz zadłużenie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SZYBKA SPŁATA / ROZLICZENIE */}
      {selectedDebtForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {selectedDebtForPayment.type === 'borrowed' ? 'Spłać zadłużenie' : 'Zarejestruj zwrot'}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedDebtForPayment.name} ({selectedDebtForPayment.counterparty})
                </p>
              </div>
              <button
                onClick={() => setSelectedDebtForPayment(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const parsedAmt = parseFloat(paymentAmount.replace(',', '.')) || 0;
              const parsedPrinc = (selectedDebtForPayment.isBankLoan && paymentPrincipal)
                ? (parseFloat(paymentPrincipal.replace(',', '.')) || 0)
                : parsedAmt;
              const remainingDebt = selectedDebtForPayment.currentRemaining;
              const isOverpaid = remainingDebt > 0 && parsedPrinc > remainingDebt + 0.009;
              const overpaidAmount = isOverpaid ? parsedPrinc - remainingDebt : 0;
              const isFinalInstallment = remainingDebt > 0 && remainingDebt <= (selectedDebtForPayment.monthlyPayment || remainingDebt);

              return (
                <>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Pozostało do rozliczenia:</span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedDebtForPayment.currentRemaining.toLocaleString('pl-PL')} zł
                    </span>
                  </div>

                  {/* Overpayment Warning Banner */}
                  {isOverpaid && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-950 animate-in fade-in shadow-2xs">
                      <div className="flex items-start space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-rose-900">
                            Kwota przewyższa pozostałe saldo zadłużenia!
                          </h4>
                          <p className="text-[11px] text-rose-700 leading-relaxed">
                            Do spłaty pozostało <strong>{remainingDebt.toFixed(2)} zł</strong>. Zadeklarowana kwota ({parsedPrinc.toFixed(2)} zł) jest za duża o <strong>{overpaidAmount.toFixed(2)} zł</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAmount(remainingDebt.toFixed(2));
                            if (selectedDebtForPayment.isBankLoan) {
                              setPaymentPrincipal(remainingDebt.toFixed(2));
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-[11px] shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ustaw dokładną kwotę spłaty ({remainingDebt.toFixed(2)} zł)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Final Installment Banner */}
                  {!isOverpaid && isFinalInstallment && (
                    <div className="p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-1.5 text-emerald-950 animate-in fade-in shadow-2xs">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-extrabold text-xs text-emerald-900">
                            🏁 Ostatnia rata / pełne rozliczenie
                          </h4>
                          <p className="text-[11px] text-emerald-800">
                            Ta wpłata całkowicie zamknie i rozliczy pozycję w sekcji Zadłużenia. Pozostało dokładnie <strong>{remainingDebt.toFixed(2)} zł</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmitPayment} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Kwota wpłaty (zł):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        autoFocus
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className={`w-full px-4 py-2.5 text-base font-black bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                          isOverpaid ? 'border-rose-400 bg-rose-50/40 text-rose-900' : 'border-slate-200'
                        }`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Data wpłaty:</label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {isInterestBearingDebt(selectedDebtForPayment) && (() => {
                      const parsedTotal = parseFloat(paymentAmount.replace(',', '.')) || 0;
                      const splitSuggestion = calculateSuggestedLoanSplit({
                        debt: selectedDebtForPayment,
                        paymentAmount: parsedTotal,
                        paymentDate,
                        paymentType,
                      });

                      return (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-indigo-50/50 to-white border border-indigo-200 space-y-3 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                                <Landmark className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-indigo-950 block leading-tight">
                                  Podział raty kredytu
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Saldo: <strong>{remainingDebt.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {splitSuggestion.isInGracePeriod ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>Karencja do {splitSuggestion.graceEndDate || 'końca'}</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-bold flex items-center gap-1">
                                  <Percent className="w-3 h-3 text-indigo-700" />
                                  <span>Oprocentowanie: {splitSuggestion.effectiveAnnualRate}%</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Baner sugestii */}
                          <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                            splitSuggestion.isInGracePeriod
                              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                              : 'bg-blue-50/70 border-blue-200 text-blue-950'
                          }`}>
                            <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${splitSuggestion.isInGracePeriod ? 'text-amber-600' : 'text-blue-600'}`} />
                            <div className="space-y-0.5">
                              <span className="font-bold block">
                                {splitSuggestion.isInGracePeriod ? '🟡 Okres karencji w spłacie kapitału' : '📐 Kalkulacja bankowa:'}
                              </span>
                              <span>{splitSuggestion.explanation}</span>
                            </div>
                          </div>

                          {/* Szybkie przyciski sugestii */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentType('regular');
                                setPaymentPrincipal(splitSuggestion.suggestedPrincipal.toFixed(2));
                                setPaymentInterest(splitSuggestion.suggestedInterest.toFixed(2));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Sugestia bankowa ({splitSuggestion.suggestedPrincipal.toFixed(2)} zł / {splitSuggestion.suggestedInterest.toFixed(2)} zł)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPaymentType('overpayment');
                                setPaymentPrincipal(parsedTotal.toFixed(2));
                                setPaymentInterest('0.00');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              100% kapitał (nadpłata)
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPaymentType('regular');
                                setPaymentPrincipal('0.00');
                                setPaymentInterest(parsedTotal.toFixed(2));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              100% odsetki (karencja)
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-indigo-100">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Spłata kapitału (zł):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={paymentPrincipal}
                                onChange={(e) => {
                                  const pVal = e.target.value;
                                  setPaymentPrincipal(pVal);
                                  const pNum = parseFloat(pVal) || 0;
                                  setPaymentInterest(Math.max(0, parsedTotal - pNum).toFixed(2));
                                }}
                                className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                                value={paymentInterest}
                                onChange={(e) => {
                                  const iVal = e.target.value;
                                  setPaymentInterest(iVal);
                                  const iNum = parseFloat(iVal) || 0;
                                  setPaymentPrincipal(Math.max(0, parsedTotal - iNum).toFixed(2));
                                }}
                                className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Typ wpłaty:
                              </label>
                              <select
                                value={paymentType}
                                onChange={(e) => {
                                  const newType = e.target.value as any;
                                  setPaymentType(newType);
                                  if (newType === 'overpayment') {
                                    setPaymentPrincipal(parsedTotal.toFixed(2));
                                    setPaymentInterest('0.00');
                                  }
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-indigo-200 rounded-xl"
                              >
                                <option value="regular">Rata standardowa</option>
                                <option value="overpayment">Nadpłata kapitału</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Notatka / komentarz:</label>
                      <input
                        type="text"
                        placeholder="np. Rata za bieżący miesiąc lub przelew BLIK"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Wpis automatycznie utworzy powiązaną transakcję w kategorii "Zobowiązania i pożyczki".
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDebtForPayment(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                      >
                        Anuluj
                      </button>
                      <button
                        type="submit"
                        disabled={isOverpaid || isNaN(parsedAmt) || parsedAmt <= 0}
                        className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        {isOverpaid ? 'Kwota przekracza saldo spłaty' : 'Zapisz spłatę'}
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 3: SZCZEGÓŁY I HISTORIA WPŁAT */}
      {selectedDebtForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Header (sticky at top) */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${
                  selectedDebtForDetails.isBankLoan || selectedDebtForDetails.category === 'kredyt_bankowy'
                    ? 'bg-indigo-50 text-indigo-600'
                    : selectedDebtForDetails.type === 'borrowed'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {selectedDebtForDetails.isBankLoan || selectedDebtForDetails.category === 'kredyt_bankowy' ? (
                    <Landmark className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      selectedDebtForDetails.type === 'borrowed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedDebtForDetails.type === 'borrowed' ? 'Moje zobowiązanie' : 'Pożyczone komuś'}
                    </span>
                    {selectedDebtForDetails.isBankLoan && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800">
                        Kredyt bankowy / hipoteczny
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    {selectedDebtForDetails.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedDebtForDetails.counterparty}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDebtForDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Początkowo</p>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    {selectedDebtForDetails.initialAmount.toLocaleString('pl-PL')} zł
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Spłacono</p>
                  <p className="text-xs sm:text-sm font-black text-emerald-600">
                    {selectedDebtForDetails.paidAmount.toLocaleString('pl-PL')} zł
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Zostało</p>
                  <p className="text-xs sm:text-sm font-black text-rose-600">
                    {selectedDebtForDetails.currentRemaining.toLocaleString('pl-PL')} zł
                  </p>
                </div>
              </div>

              {/* MORTGAGE / BANK LOAN ADVANCED STATISTICS */}
              {(() => {
                const isMortgageOrBank = selectedDebtForDetails.isBankLoan ||
                  selectedDebtForDetails.category === 'kredyt_bankowy' ||
                  selectedDebtForDetails.name.toLowerCase().includes('hipoteczn') ||
                  selectedDebtForDetails.name.toLowerCase().includes('kredyt');

                if (!isMortgageOrBank) return null;

                const d = selectedDebtForDetails;
                const history = d.paymentsHistory || [];
                const overpayments = history.filter(p => p.type === 'overpayment');
                const regularPayments = history.filter(p => p.type !== 'overpayment');

                const overpaymentsSum = overpayments.reduce((s, p) => s + (p.principalAmount ?? p.amount), 0);
                const totalPaid = d.paidAmount || 0;
                const initAmount = d.initialAmount || (totalPaid + d.currentRemaining) || 1;
                const remaining = d.currentRemaining || 0;

                const effectiveOverpayment = Math.min(totalPaid, overpaymentsSum);
                const effectiveRegular = Math.max(0, totalPaid - effectiveOverpayment);

                const regularShare = totalPaid > 0 ? (effectiveRegular / totalPaid) * 100 : 0;
                const overpaymentShare = totalPaid > 0 ? (effectiveOverpayment / totalPaid) * 100 : 0;
                const totalProgressPercent = Math.min(100, Math.max(0, (totalPaid / initAmount) * 100));

                const pmt = d.monthlyPayment || 0;
                const rate = d.interestRate || 0;
                const monthlyRate = (rate / 100) / 12;

                let monthsLeft = 0;
                if (remaining <= 0) {
                  monthsLeft = 0;
                } else if (pmt > 0) {
                  if (monthlyRate > 0 && pmt > remaining * monthlyRate) {
                    monthsLeft = Math.ceil(-Math.log(1 - (remaining * monthlyRate) / pmt) / Math.log(1 + monthlyRate));
                  } else {
                    monthsLeft = Math.ceil(remaining / pmt);
                  }
                } else if (d.loanTermYears) {
                  const totalM = Math.round(d.loanTermYears * 12);
                  const startD = d.startDate ? new Date(d.startDate) : new Date();
                  const nowD = new Date();
                  const elapsedM = Math.max(0, (nowD.getFullYear() - startD.getFullYear()) * 12 + (nowD.getMonth() - startD.getMonth()));
                  monthsLeft = Math.max(0, totalM - elapsedM);
                } else if (d.dueDate) {
                  const dueD = new Date(d.dueDate);
                  const nowD = new Date();
                  monthsLeft = Math.max(0, Math.ceil((dueD.getTime() - nowD.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
                }

                const yearsLeft = Math.floor(monthsLeft / 12);
                const monthsLeftPart = monthsLeft % 12;

                let payoffDateLabel = '';
                let payoffExactStr = '';
                if (remaining <= 0) {
                  payoffDateLabel = 'Kredyt całkowicie spłacony';
                } else if (monthsLeft > 0) {
                  const targetD = new Date();
                  targetD.setMonth(targetD.getMonth() + monthsLeft);
                  const day = d.paymentDayOfMonth || 10;
                  payoffDateLabel = targetD.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
                  payoffExactStr = `${targetD.getFullYear()}-${String(targetD.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                } else {
                  payoffDateLabel = 'Brak danych raty';
                }

                let savedMonths = 0;
                let estimatedInterestSaved = 0;
                if (effectiveOverpayment > 0 && pmt > 0 && monthlyRate > 0) {
                  const balanceWithoutOverpayment = remaining + effectiveOverpayment;
                  if (pmt > balanceWithoutOverpayment * monthlyRate) {
                    const monthsWithoutOverpay = Math.ceil(-Math.log(1 - (balanceWithoutOverpayment * monthlyRate) / pmt) / Math.log(1 + monthlyRate));
                    savedMonths = Math.max(0, monthsWithoutOverpay - monthsLeft);
                  }
                  const yearsRemainingFactor = yearsLeft + monthsLeftPart / 12;
                  estimatedInterestSaved = effectiveOverpayment * (rate / 100) * yearsRemainingFactor;
                }
                const savedYears = Math.floor(savedMonths / 12);
                const savedMonthsPart = savedMonths % 12;

                let curInterest = 0;
                let curPrincipal = 0;
                if (pmt > 0 && remaining > 0 && monthlyRate > 0) {
                  curInterest = Math.round(remaining * monthlyRate * 100) / 100;
                  curPrincipal = Math.max(0, Math.round((pmt - curInterest) * 100) / 100);
                }

                return (
                  <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-500/20 space-y-4">
                    {/* Header of Mortgage Stats */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-400/20">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-200">
                            Statystyki kredytu hipotecznego
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Podział spłaconego kapitału, nadpłaty i prognoza czasu
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                        {totalProgressPercent.toFixed(1)}% spłacone
                      </span>
                    </div>

                    {/* Progress Bar of Capital Split */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-300 font-medium">
                        <span>Spłacony kapitał:</span>
                        <span>{totalPaid.toLocaleString('pl-PL')} zł z {initAmount.toLocaleString('pl-PL')} zł</span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-slate-700">
                        {effectiveRegular > 0 && (
                          <div
                            style={{ width: `${Math.min(100, (effectiveRegular / initAmount) * 100)}%` }}
                            className="bg-indigo-500 h-full rounded-l-full transition-all"
                            title={`Normalne raty: ${effectiveRegular.toFixed(2)} zł`}
                          />
                        )}
                        {effectiveOverpayment > 0 && (
                          <div
                            style={{ width: `${Math.min(100, (effectiveOverpayment / initAmount) * 100)}%` }}
                            className="bg-emerald-400 h-full transition-all"
                            title={`Nadpłaty: ${effectiveOverpayment.toFixed(2)} zł`}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1 pt-0.5">
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                          <span>Raty: {effectiveRegular.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł ({regularShare.toFixed(0)}%)</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          <span>Nadpłaty: {effectiveOverpayment.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł ({overpaymentShare.toFixed(0)}%)</span>
                        </span>
                        <span className="text-rose-300 font-medium">
                          Pozostało: {remaining.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
                        </span>
                      </div>
                    </div>

                    {/* 4 Stat Cards */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {/* 1: Raty normalne */}
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Spłacone w normalnych ratach
                        </p>
                        <p className="text-sm sm:text-base font-black text-indigo-300 mt-0.5">
                          {effectiveRegular.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {regularShare.toFixed(1)}% spłaconego kapitału
                        </p>
                      </div>

                      {/* 2: Nadpłaty */}
                      <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                        <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                          Spłacone przez nadpłaty
                        </p>
                        <p className="text-sm sm:text-base font-black text-emerald-300 mt-0.5">
                          {effectiveOverpayment.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </p>
                        <p className="text-[10px] text-emerald-400/80 mt-0.5">
                          {overpaymentShare.toFixed(1)}% ({overpayments.length} {overpayments.length === 1 ? 'nadpłata' : overpayments.length < 5 ? 'nadpłaty' : 'nadpłat'})
                        </p>
                      </div>

                      {/* 3: Pozostały czas */}
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Ile zostało jeszcze lat
                        </p>
                        <p className="text-sm sm:text-base font-black text-amber-300 mt-0.5">
                          {remaining <= 0
                            ? '0 lat (spłacony)'
                            : monthsLeft > 0
                            ? `${yearsLeft > 0 ? `${yearsLeft} ${yearsLeft === 1 ? 'rok' : yearsLeft < 5 ? 'lata' : 'lat'} ` : ''}${monthsLeftPart > 0 ? `${monthsLeftPart} mies.` : ''}`.trim()
                            : '—'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {remaining <= 0 ? 'Kredyt rozliczony' : monthsLeft > 0 ? `Łącznie ${monthsLeft} rat` : 'Sprawdź harmonogram'}
                        </p>
                      </div>

                      {/* 4: Data spłacenia */}
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Kiedy data całkowitej spłaty
                        </p>
                        <p className="text-sm sm:text-base font-black text-white capitalize mt-0.5">
                          {payoffDateLabel}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {payoffExactStr ? `planowana: ${payoffExactStr}` : 'zgodnie z harmonogramem'}
                        </p>
                      </div>
                    </div>

                    {/* Overpayment Impact Banner */}
                    {effectiveOverpayment > 0 && (
                      <div className="p-3 bg-gradient-to-r from-emerald-950/60 to-slate-900 rounded-xl border border-emerald-500/30 flex items-start space-x-2.5">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-bold text-emerald-300">
                            Zysk z dotychczasowych nadpłat
                          </p>
                          <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                            {savedMonths > 0 ? (
                              <>
                                Dzięki nadpłatom okres spłaty skrócił się o ok.{' '}
                                <strong className="text-white">
                                  {savedYears > 0 ? `${savedYears} ${savedYears === 1 ? 'rok' : savedYears < 5 ? 'lata' : 'lat'} ` : ''}
                                  {savedMonthsPart > 0 ? `${savedMonthsPart} mies.` : ''}
                                </strong>
                                {estimatedInterestSaved > 0 && (
                                  <>, a szacowana oszczędność na odsetkach to ok. <strong className="text-emerald-300">~{estimatedInterestSaved.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</strong></>
                                )}
                                .
                              </>
                            ) : (
                              <>
                                Nadpłacona kwota <strong className="text-white">{effectiveOverpayment.toLocaleString('pl-PL')} zł</strong> zmniejszyła bezpośrednio kapitał do spłaty, redukując odsetki w każdej kolejnej racie.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Breakdown of Current Monthly Payment */}
                    {pmt > 0 && curPrincipal > 0 && curInterest > 0 && (
                      <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/40 flex flex-wrap items-center justify-between text-[11px] gap-1">
                        <span className="text-slate-400">Podział bieżącej raty ({pmt.toFixed(2)} zł):</span>
                        <span className="space-x-2">
                          <span className="text-indigo-300 font-semibold">{curPrincipal.toFixed(2)} zł kapitał</span>
                          <span className="text-slate-500">+</span>
                          <span className="text-rose-300 font-semibold">{curInterest.toFixed(2)} zł odsetki</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Payments History List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Historia rozliczeń ({selectedDebtForDetails.paymentsHistory?.length || 0})
                </h4>
                {(!selectedDebtForDetails.paymentsHistory || selectedDebtForDetails.paymentsHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Brak zarejestrowanych spłat w historii.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                    {selectedDebtForDetails.paymentsHistory.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800">
                              {p.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                            </span>
                            {p.type === 'overpayment' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Nadpłata
                              </span>
                            )}
                            {p.type === 'regular' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                Rata
                              </span>
                            )}
                          </div>
                          {p.principalAmount !== undefined && p.interestAmount !== undefined && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Kapitał: {p.principalAmount.toFixed(2)} zł | Odsetki: {p.interestAmount.toFixed(2)} zł
                            </p>
                          )}
                          {p.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{p.notes}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 font-medium">{p.date}</span>
                          <p className="text-[10px] text-slate-400">
                            Zostało po: {p.remainingAfter.toLocaleString('pl-PL')} zł
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mortgage & Bank Loan extra details if present */}
              {selectedDebtForDetails.isBankLoan && (
                <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 font-bold text-indigo-900">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <span>Parametry umowy bankowej</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {selectedDebtForDetails.bankName && (
                      <div>
                        <span className="text-slate-400">Bank:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.bankName}</span>
                      </div>
                    )}
                    {selectedDebtForDetails.loanAccountNumber && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Nr rachunku spłaty:</span>{' '}
                        <span className="font-mono text-slate-700 select-all">{selectedDebtForDetails.loanAccountNumber}</span>
                      </div>
                    )}
                    {selectedDebtForDetails.monthlyPayment && (
                      <div>
                        <span className="text-slate-400">Rata miesięczna:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.monthlyPayment} zł</span>
                      </div>
                    )}
                    {selectedDebtForDetails.rateType && (
                      <div>
                        <span className="text-slate-400">Typ rat:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.rateType === 'decreasing' ? 'Malejące' : 'Równe'}</span>
                      </div>
                    )}
                    {selectedDebtForDetails.interestRate && (
                      <div>
                        <span className="text-slate-400">Oprocentowanie:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.interestRate}%</span>
                      </div>
                    )}
                    {selectedDebtForDetails.marginRate && (
                      <div>
                        <span className="text-slate-400">Marża banku:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.marginRate}%</span>
                      </div>
                    )}
                    {selectedDebtForDetails.referenceRateType && (
                      <div>
                        <span className="text-slate-400">Stawka bazowa:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.referenceRateType}{selectedDebtForDetails.referenceRate ? ` (${selectedDebtForDetails.referenceRate}%)` : ''}</span>
                      </div>
                    )}
                    {selectedDebtForDetails.insuranceMonthly && (
                      <div>
                        <span className="text-slate-400">Ubezpieczenia:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.insuranceMonthly} zł/msc</span>
                      </div>
                    )}
                    {selectedDebtForDetails.loanTermYears && (
                      <div>
                        <span className="text-slate-400">Okres kredytu:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.loanTermYears} lat</span>
                      </div>
                    )}
                    {selectedDebtForDetails.paymentDayOfMonth && (
                      <div>
                        <span className="text-slate-400">Dzień spłaty:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.paymentDayOfMonth}. dzień msc</span>
                      </div>
                    )}
                    {selectedDebtForDetails.overpaymentCommission !== undefined && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Prowizja za nadpłatę:</span>{' '}
                        <span className="font-semibold text-slate-800">{selectedDebtForDetails.overpaymentCommission}% {selectedDebtForDetails.overpaymentCommissionYears ? `(pierwsze ${selectedDebtForDetails.overpaymentCommissionYears} lat)` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80 rounded-b-3xl">
              <button
                type="button"
                onClick={() => {
                  const debt = selectedDebtForDetails;
                  setSelectedDebtForDetails(null);
                  handleOpenEditModal(debt);
                }}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edytuj parametry</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDebtForDetails(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KALKULATOR I SYMULATOR KREDYTU */}
      {selectedDebtForCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Kalkulator i Symulator Nadpłat
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedDebtForCalculator.name} ({selectedDebtForCalculator.counterparty})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDebtForCalculator(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">
                Symulacja: Co daje jednorazowa nadpłata kredytu?
              </h4>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  step="100"
                  value={simulatorOverpayment}
                  onChange={(e) => setSimulatorOverpayment(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl w-36"
                  placeholder="Kwota nadpłaty"
                />
                <span className="text-xs text-slate-600">zł nadpłaty</span>
              </div>

              {(() => {
                const overpayVal = parseFloat(simulatorOverpayment) || 0;
                const rate = (selectedDebtForCalculator.interestRate || 7.5) / 100;
                const yearlySavings = Math.round(overpayVal * rate);
                const tenYearSavings = Math.round(overpayVal * rate * 10);

                return (
                  <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1 text-xs">
                    <p className="font-bold text-indigo-950">
                      Oszczędność na odsetkach bankowych:
                    </p>
                    <p className="text-indigo-800">
                      ~ <span className="font-black text-indigo-900">{yearlySavings.toLocaleString('pl-PL')} zł</span> rocznie mniej odsetek dla banku!
                    </p>
                    <p className="text-indigo-700 text-[11px]">
                      W perspektywie 10 lat to aż ~ <span className="font-black">{tenYearSavings.toLocaleString('pl-PL')} zł</span> czystego zysku w Twojej kieszeni.
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDebtForCalculator(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
              >
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: POTWIERDZENIE USUNIĘCIA */}
      {debtToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-100 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Usunąć wpis zadłużenia?
              </h3>
              <p className="text-xs text-slate-500">
                Czy na pewno chcesz usunąć "{debtToDelete.name}"? Spowoduje to usunięcie z rejestru zadłużeń, powiązanego rachunku, historii wpłat oraz wszystkich powiązanych transakcji w budżecie.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setDebtToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Anuluj
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
              >
                Usuń zadłużenie i powiązania
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EDYCJA ZOBOWIĄZANIA */}
      {selectedDebtForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Header (sticky at top) */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Pencil className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Edycja zadłużenia / pożyczki
                  </h2>
                  <p className="text-xs text-slate-500">
                    Zmień kwoty, warunki spłaty lub zaawansowane parametry kredytu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDebtForEdit(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDebt} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Kierunek */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Kierunek zobowiązania:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditType('borrowed')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      editType === 'borrowed'
                        ? 'border-rose-500 bg-rose-50/50 text-rose-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingDown className={`w-4 h-4 ${editType === 'borrowed' ? 'text-rose-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs">Muszę oddać</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Mój dług / kredyt</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditType('lent')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      editType === 'lent'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className={`w-4 h-4 ${editType === 'lent' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs">Ktoś musi mi oddać</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Pożyczyłem komuś</p>
                  </button>
                </div>
              </div>

              {/* Kategoria i Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Kategoria:</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as DebtCategory)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="kredyt_bankowy">Kredyt bankowy / hipoteczny</option>
                    <option value="pozyczka_prywatna">Pożyczka prywatna (znajomy)</option>
                    <option value="pozyczka_rodzina">Pożyczka od/dla rodziny</option>
                    <option value="chwilowka">Pożyczka pozabankowa / ratalna</option>
                    <option value="inne">Inne zobowiązanie</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Status zobowiązania:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'settled')}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold"
                  >
                    <option value="active">W trakcie spłaty (Aktywne)</option>
                    <option value="settled">Rozliczone w 100% (Zamknięte)</option>
                  </select>
                </div>
              </div>

              {/* Nazwa i Druga Strona */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nazwa / cel zobowiązania:</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Kredyt na mieszkanie, Pożyczka na auto"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {editType === 'borrowed' ? 'Wierzyciel (Bank / Osoba):' : 'Dłużnik (Kto pożyczył):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="np. PKO BP lub Marek"
                    value={editCounterparty}
                    onChange={(e) => setEditCounterparty(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Kwoty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Całkowita kwota początkowa (zł):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editInitialAmount}
                    onChange={(e) => setEditInitialAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Spłacono dotychczas łącznie (zł):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Podgląd pozostałej kwoty */}
              {(() => {
                const init = parseFloat(editInitialAmount.replace(',', '.')) || 0;
                const paid = parseFloat(editPaidAmount.replace(',', '.')) || 0;
                const rem = Math.max(0, init - paid);
                return (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Obliczone saldo do spłaty:</span>
                    <span className={`font-black text-sm ${editType === 'borrowed' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {rem.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                    </span>
                  </div>
                );
              })()}

              {/* Daty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Data rozpoczęcia:</label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Termin całkowitego zwrotu:</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Parametry bankowe jeśli kredyt bankowy */}
              {editCategory === 'kredyt_bankowy' && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3.5">
                  <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <span>Zaawansowane parametry kredytu hipotecznego / bankowego</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Nazwa banku:</label>
                      <input
                        type="text"
                        placeholder="np. PKO BP, mBank"
                        value={editBankName}
                        onChange={(e) => setEditBankName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Numer konta do spłaty raty:</label>
                      <input
                        type="text"
                        placeholder="np. 00 1020 0000 0000..."
                        value={editLoanAccountNumber}
                        onChange={(e) => setEditLoanAccountNumber(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Rata miesięczna (zł):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 2850.00"
                        value={editMonthlyPayment}
                        onChange={(e) => setEditMonthlyPayment(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Typ rat:</label>
                      <select
                        value={editRateType}
                        onChange={(e) => setEditRateType(e.target.value as 'equal' | 'decreasing')}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="equal">Równe (annuitetowe)</option>
                        <option value="decreasing">Malejące</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Okres (lata):</label>
                      <input
                        type="number"
                        placeholder="np. 25"
                        value={editLoanTermYears}
                        onChange={(e) => setEditLoanTermYears(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Oprocentowanie całk. (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 7.45"
                        value={editInterestRate}
                        onChange={(e) => setEditInterestRate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Marża banku (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 1.85"
                        value={editMarginRate}
                        onChange={(e) => setEditMarginRate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Wskaźnik bazowy:</label>
                      <select
                        value={editReferenceRateType}
                        onChange={(e) => setEditReferenceRateType(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                      >
                        <option value="WIBOR 3M">WIBOR 3M</option>
                        <option value="WIBOR 6M">WIBOR 6M</option>
                        <option value="WIRON">WIRON</option>
                        <option value="Stała stopa">Stała stopa</option>
                        <option value="Inne">Inne</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Dzień spłaty w msc:</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="np. 10"
                        value={editPaymentDayOfMonth}
                        onChange={(e) => setEditPaymentDayOfMonth(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Ubezpieczenia (zł/msc):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 120.00"
                        value={editInsuranceMonthly}
                        onChange={(e) => setEditInsuranceMonthly(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Karencja (miesięcy):</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={editGracePeriodMonths}
                        onChange={(e) => setEditGracePeriodMonths(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Prowizja za nadpłatę (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="np. 2.0"
                        value={editOverpaymentCommission}
                        onChange={(e) => setEditOverpaymentCommission(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700">Przez ile pierwszych lat prowizja:</label>
                      <input
                        type="number"
                        placeholder="np. 3 lata"
                        value={editOverpaymentCommissionYears}
                        onChange={(e) => setEditOverpaymentCommissionYears(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notatki */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notatki / ustalenia:</label>
                <textarea
                  rows={2}
                  placeholder="np. Ustalono spłatę w 2 transzach, bez odsetek..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              </div>

              {/* Modal buttons (sticky footer) */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0 bg-slate-50/80 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setSelectedDebtForEdit(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Zapisz zmiany</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
