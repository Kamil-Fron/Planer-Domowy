import React, { useState, useMemo } from 'react';
import {
  Zap,
  Droplets,
  Flame,
  Home,
  Wifi,
  Trash2,
  Phone,
  Radio,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Gauge,
  DollarSign,
  Check,
  History,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit3,
  X,
  FastForward,
  ArrowRightCircle,
  CalendarPlus,
  Info,
  AlertCircle,
} from 'lucide-react';
import { Bill, UtilityServiceType, Transaction, BillPricingType, BillPaymentHistoryItem } from '../types';
import {
  calculateNextDueDate,
  calculatePreviousDueDate,
  getBillingPeriodName,
  getMultipleBillingPeriods,
} from '../utils/billCycle';

interface BillsManagerProps {
  bills: Bill[];
  onAddBill: (bill: Omit<Bill, 'id' | 'createdAt'> & { id?: string }) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onDeleteBill: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  pushEnabled: boolean;
  onTogglePush: (enabled: boolean) => void;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  transactions?: Transaction[];
  onDeleteTransaction?: (id: string, skipBillRevert?: boolean) => void;
}

const formatMonthName = (monthStr: string) => {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const parts = monthStr.split('-');
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

const getAdjacentMonth = (monthStr: string, delta: number) => {
  const base = monthStr && monthStr.includes('-') ? monthStr : new Date().toISOString().slice(0, 7);
  const parts = base.split('-');
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const BillsManager: React.FC<BillsManagerProps> = ({
  bills,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onAddTransaction,
  selectedMonth,
  onMonthChange,
  transactions,
  onDeleteTransaction,
}) => {
  const [internalMonth, setInternalMonth] = useState(() => {
    return selectedMonth || new Date().toISOString().slice(0, 7);
  });
  const currentMonth = selectedMonth || internalMonth;
  const handleMonthChange = (newMonth: string) => {
    setInternalMonth(newMonth);
    if (onMonthChange) onMonthChange(newMonth);
  };
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [filterPricing, setFilterPricing] = useState<'all' | 'fixed' | 'variable'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchPayModal, setShowBatchPayModal] = useState(false);
  const [selectedBatchBills, setSelectedBatchBills] = useState<string[]>([]);
  const [showFutureBills, setShowFutureBills] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Variable bills inline edits state: billId -> { amount: string, meterCurr: string }
  const [variableEdits, setVariableEdits] = useState<
    Record<string, { amount: string; meterCurr?: string }>
  >({});

  // Stan modala wyboru daty i potwierdzenia opłacenia rachunku
  const [payModalBill, setPayModalBill] = useState<Bill | null>(null);
  const [payModalDate, setPayModalDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [payModalAmount, setPayModalAmount] = useState<string>('');
  const [payModalMeterCurr, setPayModalMeterCurr] = useState<string>('');
  const [payModalCycles, setPayModalCycles] = useState<number>(1); // Liczba opłacanych cykli (1 = bieżący, 2 = 2 z góry, etc.)

  // Stan modala przeniesienia / kumulacji nieopłaconego rachunku na kolejny miesiąc
  const [rolloverModalBill, setRolloverModalBill] = useState<Bill | null>(null);
  const [rolloverNewDate, setRolloverNewDate] = useState<string>('');
  const [rolloverMode, setRolloverMode] = useState<'accumulate' | 'defer_only'>('accumulate');
  const [rolloverAmount, setRolloverAmount] = useState<string>('');
  const [rolloverNote, setRolloverNote] = useState<string>('');

  // Stan daty w modalu opłat zbiorczych
  const [batchPayDate, setBatchPayDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Success toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Form State for new bill
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<UtilityServiceType>('prąd');
  const [pricingType, setPricingType] = useState<BillPricingType>('fixed');
  const [initialStatus, setInitialStatus] = useState<'pending' | 'paid'>('pending');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billingCycle, setBillingCycle] = useState<Bill['billingCycle']>('miesięcznie');
  const [notes, setNotes] = useState('');
  const [hasMeterReading, setHasMeterReading] = useState(false);
  const [meterPrev, setMeterPrev] = useState('');
  const [meterCurr, setMeterCurr] = useState('');
  const [meterUnit, setMeterUnit] = useState('kWh');

  // Quick DueDate Editing
  const [editingDueDateBillId, setEditingDueDateBillId] = useState<string | null>(null);
  const [tempDueDate, setTempDueDate] = useState<string>('');

  // Service helpers
  const getServiceMeta = (type: UtilityServiceType) => {
    switch (type) {
      case 'woda':
        return { label: 'Woda i ścieki', icon: Droplets, color: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-700' };
      case 'prąd':
        return { label: 'Prąd elektryczny', icon: Zap, color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700' };
      case 'gaz':
        return { label: 'Gaz ziemny', icon: Flame, color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700' };
      case 'czynsz':
        return { label: 'Czynsz spółdzielnia', icon: Home, color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700' };
      case 'internet':
        return { label: 'Internet / TV', icon: Wifi, color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700' };
      case 'śmieci':
        return { label: 'Odpady / Śmieci', icon: Trash2, color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' };
      case 'ogrzewanie':
        return { label: 'Ogrzewanie CO', icon: Flame, color: '#ef4444', bg: 'bg-rose-50', text: 'text-rose-700' };
      case 'telefon':
        return { label: 'Abonament GSM', icon: Phone, color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700' };
      default:
        return { label: 'Inne usługi', icon: Radio, color: '#64748b', bg: 'bg-slate-50', text: 'text-slate-700' };
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMonthStr = new Date().toISOString().slice(0, 7);
  const isCurrentCalendarMonth = currentMonth === todayMonthStr;

  const parseDueDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  twoWeeksFromNow.setHours(23, 59, 59, 999);

  const isNearDue = (dueDateStr: string) => {
    const d = parseDueDate(dueDateStr);
    return d.getTime() <= twoWeeksFromNow.getTime();
  };

  // Compute status helpers
  const getDueInfo = (billDueDate: string, status: Bill['status']) => {
    if (status === 'paid') {
      return { text: 'Opłacony', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
    }

    const d = new Date(billDueDate);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return {
        text: `Przeterminowany o ${Math.abs(diff)} dni`,
        color: 'text-rose-700 bg-rose-50 border-rose-200 font-bold',
        icon: AlertTriangle,
      };
    } else if (diff === 0) {
      return {
        text: 'Termin dzisiaj!',
        color: 'text-amber-700 bg-amber-50 border-amber-200 font-bold',
        icon: Clock,
      };
    } else if (diff <= 3) {
      return {
        text: `Płatność za ${diff} dni`,
        color: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold',
        icon: Clock,
      };
    } else {
      return {
        text: `Termin: ${billDueDate}`,
        color: 'text-slate-700 bg-slate-50 border-slate-200',
        icon: Calendar,
      };
    }
  };

  // 1. Rachunki do zapłaty na dany miesiąc:
  // Tyczy się tylko okresu rozliczeniowego na dany miesiąc (dueDate w tym miesiącu)
  // oraz jeśli to bieżący miesiąc kalendarzowy - rachunków zaległych z przeszłości
  const monthPendingBills = bills.filter((b) => {
    if (b.status === 'paid') return false;
    const isDueInMonth = b.dueDate.startsWith(currentMonth);
    const isPastOverdueInCurrent = isCurrentCalendarMonth && b.dueDate < currentMonth;
    return isDueInMonth || isPastOverdueInCurrent;
  });

  // 2. Uregulowane opłaty w danym miesiącu:
  // Jeśli rachunek został opłacony w wybranym miesiącu (nawet z odległą datą ważności)
  const monthPaidBills = bills.filter((b) => {
    const hasMonthPayment = b.paymentHistory?.some(
      (h) => !h.isRollover && h.paidDate.startsWith(currentMonth)
    );
    const isMarkedPaidInMonth = b.status === 'paid' && !!b.paymentDate?.startsWith(currentMonth);
    return hasMonthPayment || isMarkedPaidInMonth;
  });

  // 3. Rachunki z odległą datą ważności (przyszłe miesiące)
  const futureBills = bills.filter((b) => {
    if (b.status === 'paid') return false;
    return !monthPendingBills.some((mp) => mp.id === b.id);
  });

  // Filter matcher for types and pricing
  const matchesServiceAndPricing = (b: Bill) => {
    const matchesType = filterType === 'all' || b.serviceType === filterType;
    const matchesPricing =
      filterPricing === 'all' ||
      (filterPricing === 'fixed' && (b.pricingType === 'fixed' || !b.pricingType)) ||
      (filterPricing === 'variable' && b.pricingType === 'variable');
    return matchesType && matchesPricing;
  };

  const filteredMonthPendingBills = monthPendingBills.filter(matchesServiceAndPricing);
  const filteredMonthPaidBills = monthPaidBills.filter(matchesServiceAndPricing);
  const filteredFutureBills = futureBills.filter(matchesServiceAndPricing);

  // Prosta lista uregulowanych wpisów z historii dla wybranego miesiąca
  const settledHistoryItems = useMemo(() => {
    const list: {
      id: string;
      billId: string;
      billName: string;
      provider: string;
      serviceType: UtilityServiceType;
      pricingType: BillPricingType;
      billingCycle: Bill['billingCycle'];
      amount: number;
      paidDate: string;
      billingPeriod: string;
      meterReading?: { current: number; unit: string };
      bill: Bill;
      historyItem?: any;
    }[] = [];

    filteredMonthPaidBills.forEach((b) => {
      const monthPayments = (b.paymentHistory || []).filter(
        (h) => !h.isRollover && h.paidDate.startsWith(currentMonth)
      );

      if (monthPayments.length > 0) {
        monthPayments.forEach((h) => {
          list.push({
            id: h.id || `hist-${b.id}-${h.paidDate}`,
            billId: b.id,
            billName: b.name,
            provider: b.provider || b.name,
            serviceType: b.serviceType,
            pricingType: b.pricingType || 'fixed',
            billingCycle: b.billingCycle,
            amount: h.amount,
            paidDate: h.paidDate,
            billingPeriod: h.billingPeriod || formatMonthName(currentMonth),
            meterReading: h.meterReading,
            bill: b,
            historyItem: h,
          });
        });
      } else if (b.status === 'paid' && b.paymentDate?.startsWith(currentMonth)) {
        list.push({
          id: `paid-${b.id}`,
          billId: b.id,
          billName: b.name,
          provider: b.provider || b.name,
          serviceType: b.serviceType,
          pricingType: b.pricingType || 'fixed',
          billingCycle: b.billingCycle,
          amount: b.lastPaidAmount || b.amount,
          paidDate: b.paymentDate,
          billingPeriod: formatMonthName(currentMonth),
          meterReading: b.meterReading,
          bill: b,
        });
      }
    });

    return list.sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  }, [filteredMonthPaidBills, currentMonth]);

  // Kwoty dla wybranego miesiąca rozliczeniowego
  const totalPendingAmount = filteredMonthPendingBills.reduce((s, b) => s + b.amount, 0);
  const totalPaidAmount = useMemo(() => {
    return settledHistoryItems.reduce((sum, item) => sum + item.amount, 0);
  }, [settledHistoryItems]);

  const totalRegisteredAmount = totalPendingAmount + totalPaidAmount;
  const registeredCount = filteredMonthPendingBills.length + settledHistoryItems.length;

  // Rachunki stałe z bliskim terminem ważności (zaległe lub termin <= 14 dni) do szybkiej opłaty "Opłać"
  const nearPendingFixedBills = bills.filter(
    (b) => b.status !== 'paid' && (b.pricingType === 'fixed' || !b.pricingType) && isNearDue(b.dueDate)
  );
  const totalNearPendingFixedAmount = nearPendingFixedBills.reduce((s, b) => s + b.amount, 0);

  // Overdue bills matching filter
  const filteredOverdueBills = bills.filter((b) => {
    if (b.status === 'paid') return false;
    const d = parseDueDate(b.dueDate);
    return d.getTime() < today.getTime() && matchesServiceAndPricing(b);
  });

  const getYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const getOffsetDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const getPayDateContext = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!dateStr) return null;
    if (dateStr === todayStr) {
      return {
        label: 'Dzisiaj (bieżący dzień)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'Opłata zostanie zarejestrowana z dzisiejszą datą.',
      };
    }
    if (dateStr < todayStr) {
      const diffMs = new Date(todayStr).getTime() - new Date(dateStr).getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return {
        label: `Opłata wsteczna (${days} ${days === 1 ? 'dzień' : 'dni'} temu)`,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: 'Rachunek został już zapłacony w przeszłości. Transakcja zostanie dopasowana do tego dnia.',
      };
    }
    const diffMs = new Date(dateStr).getTime() - new Date(todayStr).getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return {
      label: `Opłata zaplanowana (za ${days} ${days === 1 ? 'dzień' : 'dni'})`,
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      description: 'Opłata nastąpi za kilka dni. Wydatek i status zostaną zapisane z wybraną datą.',
    };
  };

  /**
   * Otwarcie modala wyboru daty i opłacenia rachunku
   */
  const handleOpenPayModal = (bill: Bill) => {
    const isFixed = bill.pricingType === 'fixed' || !bill.pricingType;
    let initialAmount = bill.amount.toString();
    let initialMeterCurr = '';

    if (!isFixed && variableEdits[bill.id]) {
      if (variableEdits[bill.id].amount !== undefined) {
        initialAmount = variableEdits[bill.id].amount;
      }
      if (variableEdits[bill.id].meterCurr !== undefined) {
        initialMeterCurr = variableEdits[bill.id].meterCurr || '';
      }
    } else if (bill.meterReading) {
      initialMeterCurr = bill.meterReading.current ? bill.meterReading.current.toString() : '';
    }

    setPayModalBill(bill);
    setPayModalAmount(initialAmount);
    setPayModalMeterCurr(initialMeterCurr);
    setPayModalDate(new Date().toISOString().split('T')[0]);
    setPayModalCycles(1);
  };

  /**
   * Otwarcie okna przełożenia / kumulacji nieopłaconego rachunku na kolejny miesiąc
   */
  const handleOpenRolloverModal = (bill: Bill) => {
    const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle, 1);
    const baseAmt = bill.baseAmount || bill.amount;
    // Kwota z kumulacją: bieżąca nieopłacona kwota + kolejny cykl
    const accumulatedTotal = bill.amount + baseAmt;

    setRolloverModalBill(bill);
    setRolloverNewDate(nextDue);
    setRolloverMode('accumulate');
    setRolloverAmount(accumulatedTotal.toFixed(2));
    setRolloverNote(
      `Nieopłacony rachunek za ${getBillingPeriodName(bill.dueDate)} przeniesiony na ${getBillingPeriodName(nextDue)} z kumulacją kwoty.`
    );
    // Jeśli był otwarty modal opłacenia, zamykamy go
    setPayModalBill(null);
  };

  /**
   * Zatwierdzenie przełożenia i kumulacji rachunku na kolejny okres
   */
  const handleConfirmRollover = () => {
    if (!rolloverModalBill) return;
    const bill = rolloverModalBill;
    const parsedAmount = parseFloat(rolloverAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Proszę podać prawidłową kwotę po kumulacji.');
      return;
    }

    if (!rolloverNewDate) {
      alert('Proszę wybrać nowy termin płatności.');
      return;
    }

    const baseAmt = bill.baseAmount || bill.amount;
    const previousPeriod = getBillingPeriodName(bill.dueDate);
    const targetPeriod = getBillingPeriodName(rolloverNewDate);
    const debtAdded = rolloverMode === 'accumulate' ? baseAmt : 0;
    const newDebt = (bill.accumulatedDebt || 0) + debtAdded;
    const newRolloverCount = (bill.rolloverCount || 0) + 1;

    const rolloverHistoryEntry = {
      id: `rollover-${Date.now()}-${bill.id}`,
      amount: bill.amount,
      paidDate: new Date().toISOString().split('T')[0],
      billingPeriod: previousPeriod,
      isRollover: true,
      notes:
        rolloverMode === 'accumulate'
          ? `Przeniesiono zaległość i skumulowano do ${targetPeriod} (nowa łączna kwota do zapłaty: ${parsedAmount.toFixed(2)} PLN)`
          : `Odroczenie terminu płatności do ${targetPeriod} (kwota bez zmian: ${parsedAmount.toFixed(2)} PLN)`,
    };

    const updatedHistory = [rolloverHistoryEntry, ...(bill.paymentHistory || [])];

    onUpdateBill(bill.id, {
      dueDate: rolloverNewDate,
      previousDueDate: bill.dueDate,
      amount: parsedAmount,
      baseAmount: baseAmt,
      accumulatedDebt: newDebt,
      rolloverCount: newRolloverCount,
      paymentHistory: updatedHistory,
      notes: rolloverNote || bill.notes,
    });

    setRolloverModalBill(null);
    showToast(
      rolloverMode === 'accumulate'
        ? `Skumulowano rachunek "${bill.name}" na ${rolloverNewDate} (nowa kwota: ${parsedAmount.toFixed(2)} PLN).`
        : `Przeniesiono termin rachunku "${bill.name}" na ${rolloverNewDate}.`
    );
  };

  /**
   * Zatwierdzenie opłacenia rachunku ze wskazaną datą
   */
  const handleConfirmPayment = () => {
    if (!payModalBill) return;

    const parsedAmount = parseFloat(payModalAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Wprowadź prawidłową kwotę rachunku większą od 0.');
      return;
    }

    if (!payModalDate) {
      alert('Proszę wybrać datę opłacenia rachunku.');
      return;
    }

    const bill = payModalBill;
    const isVariable = bill.pricingType === 'variable';
    const cycles = Math.max(1, payModalCycles);
    const coveredPeriods = getMultipleBillingPeriods(bill.dueDate, bill.billingCycle, cycles);
    const periodName = coveredPeriods.join(' + ');

    // Zaktualizowany odczyt licznika jeśli podano
    let updatedMeter = bill.meterReading;
    if (payModalMeterCurr && !isNaN(parseFloat(payModalMeterCurr))) {
      const currVal = parseFloat(payModalMeterCurr);
      updatedMeter = {
        previous: bill.meterReading?.current || 0,
        current: currVal,
        unit: bill.meterReading?.unit || 'kWh',
        readingDate: payModalDate,
      };
    }

    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const historyId = `hist-${Date.now()}-${bill.id}`;

    // 1. Zapisz transakcję w wydatkach powiązaną z rachunkiem (billId, billPaymentHistoryId, billPeriodDueDate)
    onAddTransaction({
      id: txId,
      type: 'expense',
      amount: parsedAmount,
      category: 'Rachunki i media',
      date: payModalDate,
      title: `Rachunek: ${bill.name}`,
      comment:
        cycles > 1
          ? `Opłacono za ${cycles} okresy rozliczeniowe z góry (${periodName}): ${parsedAmount.toFixed(2)} PLN.${
              updatedMeter ? ` Stan licznika: ${updatedMeter.current} ${updatedMeter.unit}.` : ''
            }`
          : isVariable
          ? `Opłacono rachunek zmienny (${bill.provider}) za okres ${periodName}: ${parsedAmount.toFixed(2)} PLN.${
              updatedMeter ? ` Stan licznika: ${updatedMeter.current} ${updatedMeter.unit}.` : ''
            }`
          : `Opłacono opłatę stałą (${bill.provider}) za okres ${periodName}: ${parsedAmount.toFixed(2)} PLN.`,
      billId: bill.id,
      billPaymentHistoryId: historyId,
      billPeriodDueDate: bill.dueDate,
    });

    const newHistoryItem: BillPaymentHistoryItem = {
      id: historyId,
      transactionId: txId,
      amount: parsedAmount,
      paidDate: payModalDate,
      periodDueDate: bill.dueDate, // Precyzyjnie zapamiętany termin tego okresu
      billingPeriod: periodName,
      cycleCount: cycles,
      meterReading: updatedMeter,
      notes:
        cycles > 1
          ? `Opłacono za ${cycles} okresy (${periodName}) z datą ${payModalDate}`
          : isVariable
          ? `Opłata zmienna z datą ${payModalDate}`
          : `Opłata stała z datą ${payModalDate}`,
    };

    const updatedHistory = [newHistoryItem, ...(bill.paymentHistory || [])];

    // 2. Obsługa cykliczności z zapamiętaniem poprzedniego terminu
    if (bill.billingCycle === 'jednorazowo') {
      onUpdateBill(bill.id, {
        status: 'paid',
        amount: parsedAmount,
        previousDueDate: bill.dueDate,
        paymentDate: payModalDate,
        lastPaidAmount: parsedAmount,
        meterReading: updatedMeter,
        paymentHistory: updatedHistory,
        accumulatedDebt: 0,
        rolloverCount: 0,
      });
      showToast(
        `Opłacono jednorazowy rachunek "${bill.name}" (${parsedAmount.toFixed(2)} PLN) z datą ${payModalDate}.`
      );
    } else {
      const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle, cycles);
      // Kwota bazowa dla kolejnego pojedynczego okresu (resetujemy skumulowaną zaległość)
      const baseSingleAmount =
        bill.baseAmount ||
        (bill.amount / Math.max(1, (bill.rolloverCount || 0) + 1));

      onUpdateBill(bill.id, {
        status: 'pending',
        amount: baseSingleAmount,
        baseAmount: baseSingleAmount,
        previousDueDate: bill.dueDate,
        dueDate: nextDue,
        paymentDate: payModalDate,
        lastPaidAmount: parsedAmount,
        meterReading: updatedMeter,
        paymentHistory: updatedHistory,
        accumulatedDebt: 0,
        rolloverCount: 0,
      });
      showToast(
        cycles > 1
          ? `Opłacono "${bill.name}" za ${cycles} okresy z góry (${parsedAmount.toFixed(2)} PLN). Nowy termin: ${nextDue}.`
          : `Opłacono rachunek "${bill.name}" (${parsedAmount.toFixed(2)} PLN) z datą ${payModalDate}. Nowy termin: ${nextDue} (${bill.billingCycle}).`
      );
    }

    // Wyczyszczenie stanu edycji dla tego rachunku
    setVariableEdits((prev) => {
      const copy = { ...prev };
      delete copy[bill.id];
      return copy;
    });

    setPayModalBill(null);
  };

  /**
   * Szybkie opłacenie rachunków o bliskiej dacie ważności
   */
  const handleBatchPayFixed = () => {
    const billsToPay = nearPendingFixedBills.filter((b) => selectedBatchBills.includes(b.id));
    if (billsToPay.length === 0) return;

    const payDate = batchPayDate || new Date().toISOString().split('T')[0];
    let totalPaid = 0;

    billsToPay.forEach((bill) => {
      const periodName = getBillingPeriodName(bill.dueDate);
      totalPaid += bill.amount;

      const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const historyId = `hist-${Date.now()}-${bill.id}`;

      onAddTransaction({
        id: txId,
        type: 'expense',
        amount: bill.amount,
        category: 'Rachunki i media',
        date: payDate,
        title: `Rachunek: ${bill.name}`,
        comment: `Szybka płatność (${bill.provider}) za okres ${periodName}`,
        billId: bill.id,
        billPaymentHistoryId: historyId,
        billPeriodDueDate: bill.dueDate,
      });

      const newHistoryItem: BillPaymentHistoryItem = {
        id: historyId,
        transactionId: txId,
        amount: bill.amount,
        paidDate: payDate,
        billingPeriod: periodName,
        periodDueDate: bill.dueDate,
        notes: `Szybkie opłacenie z datą ${payDate}`,
      };
      const updatedHistory = [newHistoryItem, ...(bill.paymentHistory || [])];

      if (bill.billingCycle === 'jednorazowo') {
        onUpdateBill(bill.id, {
          status: 'paid',
          previousDueDate: bill.dueDate,
          paymentDate: payDate,
          lastPaidAmount: bill.amount,
          paymentHistory: updatedHistory,
        });
      } else {
        const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle);
        onUpdateBill(bill.id, {
          status: 'pending',
          previousDueDate: bill.dueDate,
          dueDate: nextDue,
          paymentDate: payDate,
          lastPaidAmount: bill.amount,
          paymentHistory: updatedHistory,
        });
      }
    });

    setShowBatchPayModal(false);
    setSelectedBatchBills([]);
    showToast(
      `Pomyślnie opłacono ${billsToPay.length} rachunków z datą ${payDate} na łączną kwotę ${totalPaid.toFixed(2)} PLN!`
    );
  };

  /**
   * Cofnięcie statusu / powrót do oczekujących
   */
  const handleTogglePending = (bill: Bill) => {
    if (bill.status === 'paid') {
      const restoredDueDate = bill.previousDueDate || bill.dueDate;
      onUpdateBill(bill.id, {
        status: 'pending',
        dueDate: restoredDueDate,
        paymentDate: undefined,
        previousDueDate: undefined,
      });
      showToast(`Rachunek "${bill.name}" oznaczono ponownie jako do zapłaty.`);
    }
  };

  /**
   * Cofnięcie uregulowania rachunku w danym miesiącu
   */
  const handleRevertSettledPayment = (bill: Bill, historyItemId?: string) => {
    const history = bill.paymentHistory || [];
    const itemToRevert = historyItemId
      ? history.find((h) => h.id === historyItemId)
      : history.find((h) => !h.isRollover && h.paidDate.startsWith(currentMonth)) ||
        history.find((h) => !h.isRollover) ||
        history[0];

    if (!itemToRevert && bill.status !== 'paid') {
      showToast('Nie znaleziono wpisu opłaty do cofnięcia.');
      return;
    }

    // 1. Wyznacz precyzyjnie pierwotny termin do przywrócenia:
    // Jeśli wpis historii ma zapamiętany pierwotny termin tego okresu (periodDueDate), używamy go!
    // Dzięki temu termin powraca DOKŁADNIE do okresu, który cofamy, bez względu na inne okresy.
    const cyclesToRevert = itemToRevert?.cycleCount || 1;
    const restoredDueDate =
      itemToRevert?.periodDueDate ||
      bill.previousDueDate ||
      calculatePreviousDueDate(bill.dueDate, bill.billingCycle, cyclesToRevert);

    // 2. Usuń WYŁĄCZNIE ten jeden konkretny wpis z historii płatności
    const updatedHistory = itemToRevert
      ? history.filter((h) => h.id !== itemToRevert.id)
      : history;

    // 3. Zaktualizuj rachunek (POJEDYNCZA atomowa aktualizacja stanu)
    onUpdateBill(bill.id, {
      status: 'pending',
      dueDate: restoredDueDate,
      previousDueDate: undefined,
      paymentDate: undefined,
      paymentHistory: updatedHistory,
      lastPaidAmount: updatedHistory[0]?.amount,
    });

    // 4. Usuń powiązaną transakcję ze spisu transakcji z flagą skipBillRevert: true,
    // aby handleDeleteTransaction w App.tsx NIE próbował cofać rachunku po raz drugi!
    if (onDeleteTransaction && transactions) {
      const matchTx = transactions.find((t) => {
        // Priorytet 1: bezpośrednie powiązanie po ID wpisu historii lub transakcji
        if (itemToRevert?.transactionId && t.id === itemToRevert.transactionId) return true;
        if (itemToRevert?.id && t.billPaymentHistoryId === itemToRevert.id) return true;
        if (t.billId === bill.id) {
          // Priorytet 2: po terminie okresu rozliczeniowego
          if (itemToRevert?.periodDueDate && t.billPeriodDueDate === itemToRevert.periodDueDate) {
            return true;
          }
          // Priorytet 3: po kwocie i dacie opłaty
          if (itemToRevert) {
            return (
              Math.abs(t.amount - itemToRevert.amount) < 0.05 &&
              (t.date === itemToRevert.paidDate ||
                t.date.slice(0, 7) === itemToRevert.paidDate.slice(0, 7))
            );
          }
          return t.date.startsWith(currentMonth);
        }
        return false;
      });

      if (matchTx) {
        onDeleteTransaction(matchTx.id, true);
      }
    }

    const periodLabel = itemToRevert?.billingPeriod || formatMonthName(currentMonth);
    showToast(`Cofnięto opłatę za okres "${periodLabel}". Rachunek powrócił do "Do zapłaty".`);
  };

  // Handle Create Bill
  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const parsedAmount = parseFloat(amount);
    const todayDate = new Date().toISOString().split('T')[0];
    const actualPayDate = initialStatus === 'paid' ? (paidDate || todayDate) : todayDate;
    const periodName = getBillingPeriodName(dueDate);

    const meterData =
      hasMeterReading && meterCurr
        ? {
            previous: parseFloat(meterPrev) || 0,
            current: parseFloat(meterCurr),
            unit: meterUnit,
            readingDate: actualPayDate,
          }
        : undefined;

    if (initialStatus === 'paid') {
      const newBillId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // 1. Zapisz transakcję w wydatkach z billId
      onAddTransaction({
        type: 'expense',
        amount: parsedAmount,
        category: 'Rachunki i media',
        date: actualPayDate,
        title: `Rachunek: ${name.trim()}`,
        comment: `Opłacono rachunek (${name.trim()}) za okres ${periodName}.${
          meterData ? ` Stan licznika: ${meterData.current} ${meterData.unit}.` : ''
        }`,
        billId: newBillId,
      });

      const newHistoryItem = {
        id: `hist-${Date.now()}`,
        amount: parsedAmount,
        paidDate: actualPayDate,
        billingPeriod: periodName,
        meterReading: meterData,
        notes: 'Opłacono podczas dodawania rachunku',
      };

      // 2. Dodaj rachunek jako opłacony z tym samym ID
      onAddBill({
        id: newBillId,
        name: name.trim(),
        serviceType,
        pricingType,
        provider: name.trim(),
        amount: parsedAmount,
        dueDate,
        previousDueDate: dueDate,
        billingCycle,
        status: 'paid',
        paymentDate: actualPayDate,
        lastPaidAmount: parsedAmount,
        paymentHistory: [newHistoryItem],
        notes: notes.trim() || undefined,
        meterReading: meterData,
      });

      showToast(
        `Dodano rachunek "${name.trim()}" i zaksięgowano ${parsedAmount.toFixed(
          2
        )} PLN w wydatkach (data: ${actualPayDate}).`
      );
    } else {
      // Oczekujący na opłacenie
      onAddBill({
        name: name.trim(),
        serviceType,
        pricingType,
        provider: name.trim(),
        amount: parsedAmount,
        dueDate,
        billingCycle,
        status: 'pending',
        notes: notes.trim() || undefined,
        meterReading: meterData,
      });

      showToast(`Pomyślnie dodano rachunek "${name.trim()}" (termin: ${dueDate}).`);
    }

    // Reset Form
    setName('');
    setProvider('');
    setAmount('');
    setNotes('');
    setPaidDate(new Date().toISOString().split('T')[0]);
    setPricingType('fixed');
    setInitialStatus('pending');
    setHasMeterReading(false);
    setMeterPrev('');
    setMeterCurr('');
    setShowAddModal(false);
  };

  const renderBillCard = (bill: Bill) => {
    const meta = getServiceMeta(bill.serviceType);
    const ServiceIcon = meta.icon;
    const dueInfo = getDueInfo(bill.dueDate, bill.status);
    const DueIcon = dueInfo.icon;
    const isFixed = bill.pricingType === 'fixed' || !bill.pricingType;
    const isVariable = bill.pricingType === 'variable';
    const isHistoryOpen = expandedHistoryId === bill.id;

    // Local variable editing state
    const currentVariableEdit = variableEdits[bill.id] || {
      amount: bill.amount.toString(),
      meterCurr: bill.meterReading?.current?.toString() || '',
    };

    return (
      <div
        key={bill.id}
        className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md flex flex-col justify-between ${
          bill.status === 'paid'
            ? 'border-emerald-200 bg-emerald-50/10'
            : 'border-slate-200'
        }`}
      >
        <div>
          {/* Card Top */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-2xl ${meta.bg} ${meta.text}`}>
                <ServiceIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-snug">{bill.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{bill.provider}</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  if (editingDueDateBillId === bill.id) {
                    setEditingDueDateBillId(null);
                  } else {
                    setEditingDueDateBillId(bill.id);
                    setTempDueDate(bill.dueDate);
                  }
                }}
                className={`transition-colors p-1 rounded-md ${
                  editingDueDateBillId === bill.id
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-slate-300 hover:text-indigo-600'
                }`}
                title="Zmień termin płatności"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDeleteBill(bill.id)}
                className="text-slate-300 hover:text-rose-600 transition-colors p-1 rounded-md"
                title="Usuń rachunek"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Due Date Editor */}
          {editingDueDateBillId === bill.id && (
            <div className="mt-2.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center space-x-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-semibold text-indigo-900 shrink-0">Termin:</span>
                <input
                  type="date"
                  value={tempDueDate}
                  onChange={(e) => setTempDueDate(e.target.value)}
                  className="text-xs bg-white border border-indigo-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (tempDueDate) {
                      onUpdateBill(bill.id, { dueDate: tempDueDate });
                      showToast(`Zaktualizowano termin "${bill.name}" na ${tempDueDate}.`);
                      setEditingDueDateBillId(null);
                    }
                  }}
                  className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors"
                  title="Zapisz termin"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDueDateBillId(null)}
                  className="p-1 text-slate-400 hover:bg-slate-200 rounded-md transition-colors"
                  title="Anuluj"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Badges: Fixed vs Variable & Cycle */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                  isFixed
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isFixed ? 'Opłata stała' : 'Opłata zmienna'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                {bill.billingCycle}
              </span>
            </div>

            {bill.paymentHistory && bill.paymentHistory.length > 0 && (
              <button
                onClick={() =>
                  setExpandedHistoryId(isHistoryOpen ? null : bill.id)
                }
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-medium"
              >
                <History className="w-3.5 h-3.5" />
                <span>{bill.paymentHistory.length} płatn.</span>
                {isHistoryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Amount & Pricing Mode View */}
          {isFixed ? (
            /* FIXED BILL VIEW: Display static amount */
            <div className="my-4 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-slate-900">
                  {bill.amount.toFixed(2)}{' '}
                  <span className="text-xs font-bold text-slate-500">PLN</span>
                </span>
                {bill.lastPaidAmount && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Ostatnio opłacono: {bill.lastPaidAmount.toFixed(2)} PLN
                  </p>
                )}
              </div>

              <div
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-xs ${dueInfo.color}`}
              >
                <DueIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-semibold">{dueInfo.text}</span>
              </div>
            </div>
          ) : (
            /* VARIABLE BILL VIEW: Direct inline edit for amount and meter reading */
            <div className="my-3 p-3 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-amber-900 flex items-center space-x-1">
                  <Edit3 className="w-3 h-3 text-amber-700" />
                  <span>Kwota do opłacenia (PLN):</span>
                </label>
                <span className="text-[10px] text-amber-700 font-medium">wg rachunku</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={currentVariableEdit.amount}
                  onChange={(e) => {
                    setVariableEdits((prev) => ({
                      ...prev,
                      [bill.id]: {
                        ...currentVariableEdit,
                        amount: e.target.value,
                      },
                    }));
                  }}
                  className="w-full px-3 py-1.5 text-base font-black text-slate-900 bg-white border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                  PLN
                </span>
              </div>

              {/* Meter reading field for variable bills */}
              {bill.meterReading && (
                <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1 text-[11px] text-amber-800">
                    <Gauge className="w-3 h-3 text-amber-600" />
                    <span>Licznik ({bill.meterReading.unit}):</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`poprz: ${bill.meterReading.current}`}
                    value={currentVariableEdit.meterCurr || ''}
                    onChange={(e) => {
                      setVariableEdits((prev) => ({
                        ...prev,
                        [bill.id]: {
                          ...currentVariableEdit,
                          meterCurr: e.target.value,
                        },
                      }));
                    }}
                    className="w-24 px-2 py-1 text-xs font-bold text-slate-800 bg-white border border-amber-300 rounded-lg text-right"
                  />
                </div>
              )}

              <div
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${dueInfo.color}`}
              >
                <DueIcon className="w-3 h-3 flex-shrink-0" />
                <span className="font-medium">{dueInfo.text}</span>
              </div>
            </div>
          )}

          {/* Meter Reading details for fixed or static cards */}
          {isFixed && bill.meterReading && (
            <div className="mb-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-slate-500" />
                <span>Stan licznika:</span>
              </div>
              <div className="font-semibold text-slate-800">
                {bill.meterReading.current} {bill.meterReading.unit}
              </div>
            </div>
          )}

          {/* Accumulated Debt Banner */}
          {bill.accumulatedDebt && bill.accumulatedDebt > 0 ? (
            <div className="mb-3 px-3 py-2 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-bold text-[11px] truncate">
                  Skumulowana zaległość ({bill.rolloverCount || 1} {bill.rolloverCount === 1 ? 'okres' : 'okresy'})
                </span>
              </div>
              <span className="font-extrabold text-[11px] text-amber-700 shrink-0">
                +{bill.accumulatedDebt.toFixed(2)} PLN
              </span>
            </div>
          ) : null}

          {/* Smart Auto-Resolution: Gdy rachunek ma termin z przeszłego okresu, a transakcja/opłata już za niego istnieje */}
          {(() => {
            const billCycleMonth = bill.dueDate.slice(0, 7);
            if (bill.status !== 'paid' && billCycleMonth < currentMonth) {
              const matchingPaidTx = transactions?.find(
                (t) =>
                  t.billId === bill.id &&
                  (t.date.slice(0, 7) === billCycleMonth || t.billPeriodDueDate === bill.dueDate)
              );

              if (matchingPaidTx) {
                return (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5 shadow-2xs">
                    <div className="flex items-start space-x-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          Wykryto opłacony okres ({formatMonthName(billCycleMonth)})
                        </span>
                        <p className="text-[11px] text-amber-800">
                          W rejestrze wydatków istnieje już opłata z dnia {matchingPaidTx.date} ({matchingPaidTx.amount.toFixed(2)} PLN).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle);
                        onUpdateBill(bill.id, {
                          dueDate: nextDue,
                          status: 'pending',
                        });
                        showToast(`Zaktualizowano termin "${bill.name}" do właściwego cyklu (${nextDue}).`);
                      }}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 shadow-2xs transition-colors"
                    >
                      <span>Przesuń termin na bieżący okres rozliczeniowy</span>
                    </button>
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* Notes */}
          {bill.notes && (
            <p className="text-[11px] text-slate-500 mb-3 italic bg-slate-50 p-2 rounded-lg">
              {bill.notes}
            </p>
          )}

          {/* Payment History Expandable */}
          {isHistoryOpen && bill.paymentHistory && (
            <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 animate-in fade-in">
              <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider block">
                Historia uregulowanych cykli
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {bill.paymentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100 text-[11px]"
                  >
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="font-semibold text-slate-800">
                          {item.billingPeriod || item.paidDate}
                        </span>
                        {item.isRollover && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                            Przełożenie
                          </span>
                        )}
                        {item.cycleCount && item.cycleCount > 1 && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                            {item.cycleCount} okresy
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 block text-[10px]">
                        {item.isRollover ? 'Przeniesiono: ' : 'Zapłacono: '}{item.paidDate}
                      </span>
                    </div>
                    <span className={`font-bold ${item.isRollover ? 'text-amber-700' : 'text-emerald-600'}`}>
                      {item.amount.toFixed(2)} PLN
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Area: Prominent Green Pay Button & Rollover Option */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 font-medium">
            {meta.label} • {bill.billingCycle}
          </span>

          {bill.status === 'paid' ? (
            <button
              onClick={() => handleTogglePending(bill)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
              title="Cofnij status do oczekującego"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Oznacz jako do zapłaty</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 shrink-0">
              {bill.billingCycle !== 'jednorazowo' && (
                <button
                  type="button"
                  onClick={() => handleOpenRolloverModal(bill)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors"
                  title="Przełóż nieopłacony rachunek na kolejny okres (kumulacja kwoty)"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Przełóż / Kumuluj</span>
                </button>
              )}

              {isFixed ? (
                /* FIXED BILL: Otwarcie okna wyboru daty i opłacenia */
                <button
                  onClick={() => handleOpenPayModal(bill)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs shrink-0"
                  title="Wybierz datę i opłać rachunek"
                >
                  <Check className="w-4 h-4" />
                  <span>Opłać {bill.amount.toFixed(2)} PLN</span>
                </button>
              ) : (
                /* VARIABLE BILL: Otwarcie okna wyboru daty i opłacenia */
                <button
                  onClick={() => handleOpenPayModal(bill)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs shrink-0"
                  title="Wybierz datę i opłać rachunek"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Opłać {parseFloat(currentVariableEdit.amount || '0').toFixed(2)} PLN
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Prosta lista historii uregulowanych opłat w wybranym miesiącu
   */
  const renderSettledHistoryList = (items: typeof settledHistoryItems) => {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-2xs overflow-hidden">
        {items.map((item) => {
          const meta = getServiceMeta(item.serviceType);
          const ServiceIcon = meta.icon;
          return (
            <div
              key={item.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className={`p-2.5 rounded-xl ${meta.bg} ${meta.text} shrink-0`}>
                  <ServiceIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {item.billName}
                    </span>
                    <span className="text-xs text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium truncate">
                      {item.provider}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Uregulowano</span>
                    </span>
                    {item.historyItem?.cycleCount && item.historyItem.cycleCount > 1 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1 shrink-0">
                        <CalendarPlus className="w-3 h-3 text-blue-600" />
                        <span>{item.historyItem.cycleCount} okresy z góry</span>
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">
                      {item.pricingType === 'variable' ? 'Zmienna' : 'Stała'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1 flex-wrap gap-y-1">
                    <span>
                      Okres: <strong className="text-slate-700 font-semibold">{item.billingPeriod}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Data opłacenia: <strong className="text-slate-700 font-medium">{item.paidDate}</strong></span>
                    </span>
                    {item.meterReading && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Gauge className="w-3.5 h-3.5 text-slate-400" />
                          <span>Licznik: <strong className="text-slate-700 font-medium">{item.meterReading.current} {item.meterReading.unit}</strong></span>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="capitalize text-slate-400">{item.billingCycle}</span>
                  </div>
                  {item.historyItem?.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      {item.historyItem.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-4 pl-12 sm:pl-0 shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-base font-black text-emerald-700 block">
                    {item.amount.toFixed(2)} PLN
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium block">
                    wpis z historii
                  </span>
                </div>

                <button
                  onClick={() => handleRevertSettledPayment(item.bill, item.historyItem?.id)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold flex items-center space-x-1 transition-all shadow-2xs"
                  title="Cofnij tę opłatę i przywróć rachunek do oczekujących"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
                  <span className="hidden sm:inline">Cofnij opłatę</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/40 flex items-center space-x-2.5 text-xs sm:text-sm font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Title and Plus Button */}
      <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Rachunki i Media
              </h1>
              {monthPendingBills.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {monthPendingBills.length} do opłacenia
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action: Plus Button */}
        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs font-semibold text-xs sm:text-sm"
            title="Dodaj nowy rachunek"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nowy rachunek</span>
          </button>
        </div>
      </div>

      {/* Month Selector Bar */}
      <div className="bg-white rounded-2xl px-5 py-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Okres rozliczeniowy:
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              isCurrentCalendarMonth
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {isCurrentCalendarMonth ? 'Bieżący miesiąc' : 'Wybrany okres'}
          </span>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => handleMonthChange(getAdjacentMonth(currentMonth, -1))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Poprzedni miesiąc"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm font-black text-slate-900 capitalize min-w-[140px] text-center">
            {formatMonthName(currentMonth)}
          </span>

          <button
            onClick={() => handleMonthChange(getAdjacentMonth(currentMonth, 1))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Następny miesiąc"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrentCalendarMonth && (
            <button
              onClick={() => handleMonthChange(todayMonthStr)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors ml-1"
            >
              Bieżący
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards for the selected month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Do zapłaty ({formatMonthName(currentMonth)})
            </span>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {totalPendingAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {monthPendingBills.length} oczekujących płatności
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Uregulowane opłaty ({formatMonthName(currentMonth)})
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {totalPaidAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {monthPaidBills.length} uregulowanych pozycji
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Zarejestrowane opłaty ({formatMonthName(currentMonth)})
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalRegisteredAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {registeredCount} pozycji w tym miesiącu
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Pay Alert Banner for Bills with near due date */}
      {nearPendingFixedBills.length > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-emerald-950">
                Rachunki z bliskim terminem do opłacenia: {nearPendingFixedBills.length}{' '}
                {nearPendingFixedBills.length === 1 ? 'pozycja' : 'pozycje'} (
                {totalNearPendingFixedAmount.toFixed(2)} PLN)
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Termin płatności przypada w ciągu najbliższych 14 dni lub upłynął. Możesz uregulować je jednym kliknięciem.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedBatchBills(nearPendingFixedBills.map((b) => b.id));
              setShowBatchPayModal(true);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs shrink-0"
            title="Opłać rachunki z bliskim terminem ważności"
          >
            <Check className="w-4 h-4" />
            <span>Opłać ({totalNearPendingFixedAmount.toFixed(2)} PLN)</span>
          </button>
        </div>
      )}

      {/* Filter and Mode Bar - fully responsive with no overflow */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Row 1: Type & Media Filters */}
        <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors shrink-0 ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Wszystkie media
          </button>
          {(['woda', 'prąd', 'gaz', 'czynsz', 'internet', 'śmieci'] as UtilityServiceType[]).map((st) => {
            const meta = getServiceMeta(st);
            return (
              <button
                key={st}
                onClick={() => setFilterType(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center space-x-1.5 shrink-0 ${
                  filterType === st
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <meta.icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Pricing Mode & Status Filters (Clean responsive wrap, contained within frame) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          {/* Pricing type switch */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Koszty:
            </span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setFilterPricing('all')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterPricing === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setFilterPricing('fixed')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterPricing === 'fixed' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Stałe
              </button>
              <button
                onClick={() => setFilterPricing('variable')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterPricing === 'variable' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Zmienne
              </button>
            </div>
          </div>

          {/* Status switch */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Status:
            </span>
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterStatus === 'pending' ? 'bg-rose-600 text-white shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Do zapłaty
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterStatus === 'paid' ? 'bg-emerald-600 text-white shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Opłacone
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bills Cards Grid */}
      {(() => {
        if (filterStatus === 'paid') {
          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>
                    Uregulowane opłaty ({formatMonthName(currentMonth)}): {settledHistoryItems.length}
                  </span>
                </h2>
                {settledHistoryItems.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    Łącznie uregulowano: {totalPaidAmount.toFixed(2)} PLN
                  </span>
                )}
              </div>

              {settledHistoryItems.length > 0 ? (
                renderSettledHistoryList(settledHistoryItems)
              ) : (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Brak opłat uregulowanych w miesiącu {formatMonthName(currentMonth)}.
                  </p>
                  <p className="text-xs text-slate-400">
                    Gdy opłacisz rachunek w tym okresie, pojawi się on tutaj w historii oraz w Twoich transakcjach.
                  </p>
                </div>
              )}
            </div>
          );
        }

        if (filterStatus === 'pending') {
          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-rose-500" />
                  <span>
                    Rachunki do zapłaty ({formatMonthName(currentMonth)}): {filteredMonthPendingBills.length}
                  </span>
                </h2>
                {filteredMonthPendingBills.length > 0 && (
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 self-start sm:self-auto">
                    Do zapłaty: {totalPendingAmount.toFixed(2)} PLN
                  </span>
                )}
              </div>

              {filteredMonthPendingBills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredMonthPendingBills.map(renderBillCard)}
                </div>
              ) : (
                <div className="p-8 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-base font-bold text-emerald-950">
                    Wszystkie rachunki na {formatMonthName(currentMonth)} są uregulowane!
                  </p>
                  <p className="text-xs text-emerald-800/80 max-w-md mx-auto">
                    Brak oczekujących rachunków do opłacenia w tym miesiącu rozliczeniowym.
                    {filteredFutureBills.length > 0 &&
                      ` Rachunki na kolejne miesiące (${filteredFutureBills.length}) znajdziesz w sekcji rachunków przyszłych.`}
                  </p>
                </div>
              )}
            </div>
          );
        }

        if (filterStatus === 'overdue') {
          return (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Rachunki przeterminowane ({filteredOverdueBills.length})</span>
              </h2>
              {filteredOverdueBills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredOverdueBills.map(renderBillCard)}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    Brak przeterminowanych rachunków. Wszystko pod kontrolą!
                  </p>
                </div>
              )}
            </div>
          );
        }

        // 'all' filter: Display Month Pending, Month Paid, and Future Bills
        const futureTotal = filteredFutureBills.reduce((s, b) => s + b.amount, 0);

        return (
          <div className="space-y-8">
            {/* Section 1: Month Pending Bills */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-rose-500" />
                  <span>
                    Do zapłaty w tym miesiącu ({formatMonthName(currentMonth)})
                  </span>
                </h2>
                {filteredMonthPendingBills.length > 0 && (
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 self-start sm:self-auto">
                    {filteredMonthPendingBills.length}{' '}
                    {filteredMonthPendingBills.length === 1 ? 'rachunek' : 'rachunki'} •{' '}
                    {totalPendingAmount.toFixed(2)} PLN
                  </span>
                )}
              </div>

              {filteredMonthPendingBills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredMonthPendingBills.map(renderBillCard)}
                </div>
              ) : (
                <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-emerald-950">
                    Wszystkie rachunki na {formatMonthName(currentMonth)} zostały uregulowane!
                  </p>
                  <p className="text-xs text-emerald-800/80 max-w-md mx-auto">
                    Brak oczekujących rachunków w okresie {formatMonthName(currentMonth)}.
                    {filteredFutureBills.length > 0 &&
                      ` Kolejne płatności przypadają w odległych terminach (${filteredFutureBills.length}).`}
                  </p>
                </div>
              )}
            </div>

            {/* Section 2: Month Paid Bills (Simple History List) */}
            {settledHistoryItems.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      Uregulowane w miesiącu {formatMonthName(currentMonth)} ({settledHistoryItems.length})
                    </span>
                  </h2>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 self-start sm:self-auto">
                    Opłacono: {totalPaidAmount.toFixed(2)} PLN
                  </span>
                </div>
                {renderSettledHistoryList(settledHistoryItems)}
              </div>
            )}

            {/* Section 3: Future Bills (Collapsible) */}
            {filteredFutureBills.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => setShowFutureBills(!showFutureBills)}
                  className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 hover:bg-slate-100/90 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">
                          Rachunki z odległą datą ważności (kolejne miesiące)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                          {filteredFutureBills.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Łączna kwota: <span className="font-semibold text-slate-700">{futureTotal.toFixed(2)} PLN</span> • Nieobciążające bieżącego miesiąca ({formatMonthName(currentMonth)})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto shrink-0">
                    <span>{showFutureBills ? 'Ukryj rachunki przyszłe' : 'Rozwiń rachunki przyszłe'}</span>
                    {showFutureBills ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showFutureBills && (
                  <div className="p-5 border-t border-slate-200 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-top-2">
                      {filteredFutureBills.map(renderBillCard)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredMonthPendingBills.length === 0 &&
              filteredMonthPaidBills.length === 0 &&
              filteredFutureBills.length === 0 && (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <p className="text-sm text-slate-500">Brak rachunków spełniających kryteria filtrów.</p>
                </div>
              )}
          </div>
        );
      })()}

      {/* Batch Pay Modal for Near Due Bills */}
      {showBatchPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Rachunki z bliskim terminem ważności
                </h3>
                <p className="text-xs text-slate-500">
                  Zatwierdź każdy rachunek osobno lub ureguluj wybrane pozycje zbiorczo.
                </p>
              </div>
            </div>

            {/* Selection Toolbar */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="font-medium">Lista do opłacenia ({nearPendingFixedBills.length}):</span>
              <div className="flex items-center space-x-2 font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedBatchBills(nearPendingFixedBills.map((b) => b.id))}
                  className="text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  Zaznacz wszystkie
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setSelectedBatchBills([])}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Odznacz
                </button>
              </div>
            </div>

            {/* List with Individual Pay Buttons */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {nearPendingFixedBills.map((b) => {
                const isSelected = selectedBatchBills.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBatchBills([...selectedBatchBills, b.id]);
                          } else {
                            setSelectedBatchBills(selectedBatchBills.filter((id) => id !== b.id));
                          }
                        }}
                        className="rounded-sm text-emerald-600 focus:ring-emerald-600 w-4 h-4 shrink-0"
                      />
                      <div className="truncate">
                        <span className="font-bold text-slate-800 block truncate">{b.name}</span>
                        <span className="text-[10px] text-slate-400 block capitalize">
                          {b.provider} • Termin: {b.dueDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 shrink-0">
                      <span className="font-black text-slate-900 whitespace-nowrap">
                        {b.amount.toFixed(2)} PLN
                      </span>

                      {/* Individual Approval Button */}
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenPayModal(b);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs"
                        title="Wybierz datę i opłać ten rachunek"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Zatwierdź</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Data opłacenia dla operacji zbiorczej */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Data realizacji płatności zbiorczej:</span>
                </label>
                {batchPayDate && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {batchPayDate === new Date().toISOString().split('T')[0]
                      ? 'Dzisiaj'
                      : batchPayDate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={batchPayDate}
                  onChange={(e) => setBatchPayDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setBatchPayDate(new Date().toISOString().split('T')[0])}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Dzisiaj
                </button>
                <button
                  type="button"
                  onClick={() => setBatchPayDate(getYesterdayDate())}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Wczoraj
                </button>
              </div>
            </div>

            {/* Summary of Selected Items */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-900 block">Zaznaczono do opłacenia:</span>
                <span className="text-[11px] text-emerald-700">
                  {selectedBatchBills.length} z {nearPendingFixedBills.length} rachunków
                </span>
              </div>
              <span className="text-lg font-black text-emerald-700">
                {nearPendingFixedBills
                  .filter((b) => selectedBatchBills.includes(b.id))
                  .reduce((sum, b) => sum + b.amount, 0)
                  .toFixed(2)}{' '}
                PLN
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchPayModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Zamknij
              </button>
              <button
                type="button"
                disabled={selectedBatchBills.length === 0}
                onClick={handleBatchPayFixed}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>
                  Opłać zaznaczone ({selectedBatchBills.length})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal wyboru daty i potwierdzenia opłacenia rachunku */}
      {payModalBill && (() => {
        const bill = payModalBill;
        const meta = getServiceMeta(bill.serviceType);
        const ServiceIcon = meta.icon;
        const dateCtx = getPayDateContext(payModalDate);
        const numAmount = parseFloat(payModalAmount);
        const isValidAmount = !isNaN(numAmount) && numAmount > 0;
        const nextDuePreview =
          bill.billingCycle === 'jednorazowo'
            ? null
            : calculateNextDueDate(bill.dueDate, bill.billingCycle, payModalCycles);
        const coveredPeriodsPreview =
          bill.billingCycle === 'jednorazowo'
            ? [getBillingPeriodName(bill.dueDate)]
            : getMultipleBillingPeriods(bill.dueDate, bill.billingCycle, payModalCycles);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    <ServiceIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      Opłać rachunek: {bill.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dostawca: <span className="font-semibold text-slate-700">{bill.provider}</span> • Termin z umowy:{' '}
                      <span className="font-semibold text-slate-700">{bill.dueDate}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayModalBill(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Zamknij"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informacyjny komunikat o dacie */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-xl text-xs text-emerald-950 flex items-start space-x-2.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Wskaż datę wykonania opłaty:</p>
                  <p className="text-emerald-800/90 text-[11px] leading-relaxed">
                    Możesz wybrać datę dzisiejszą, wsteczną (gdy rachunek został już opłacony) lub przyszłą (gdy wiesz, że opłata nastąpi za kilka dni).
                  </p>
                </div>
              </div>

              {/* Wybór daty opłaty */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Data realizacji płatności:</span>
                  </label>
                  {dateCtx && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${dateCtx.badgeClass}`}
                    >
                      {dateCtx.label}
                    </span>
                  )}
                </div>

                <input
                  type="date"
                  value={payModalDate}
                  onChange={(e) => setPayModalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
                />

                {/* Szybkie przyciski wyboru daty */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setPayModalDate(new Date().toISOString().split('T')[0])}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-colors ${
                      payModalDate === new Date().toISOString().split('T')[0]
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Dzisiaj
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayModalDate(getYesterdayDate())}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-colors ${
                      payModalDate === getYesterdayDate()
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Wczoraj
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayModalDate(bill.dueDate)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-colors ${
                      payModalDate === bill.dueDate
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                    title="Ustaw datę zgodną z terminem płatności z rachunku"
                  >
                    Termin rachunku ({bill.dueDate})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayModalDate(getOffsetDate(3))}
                    className="px-2.5 py-1 text-xs rounded-lg font-semibold border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    +3 dni
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayModalDate(getOffsetDate(7))}
                    className="px-2.5 py-1 text-xs rounded-lg font-semibold border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    +7 dni
                  </button>
                </div>
              </div>

              {/* Wybór liczby okresów / Opłacenie z góry */}
              {bill.billingCycle !== 'jednorazowo' && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                      <span>Okresy płatności (płatność z góry):</span>
                    </label>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {payModalCycles === 1 ? 'Bieżący okres (1 cykl)' : `${payModalCycles} okresy z góry`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((c) => {
                      const baseAmt =
                        bill.baseAmount ||
                        (bill.amount / Math.max(1, (bill.rolloverCount || 0) + 1));
                      const isSelected = payModalCycles === c;
                      const calculatedAmt = (baseAmt * c).toFixed(2);

                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setPayModalCycles(c);
                            setPayModalAmount(calculatedAmt);
                          }}
                          className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-bold">
                            {c === 1 ? '1 okres' : `${c} okresy ${c === 2 ? '(z góry)' : ''}`}
                          </span>
                          <span
                            className={`text-[11px] mt-0.5 font-medium ${
                              isSelected ? 'text-blue-100' : 'text-slate-500'
                            }`}
                          >
                            {calculatedAmt} PLN
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {payModalCycles > 1 && (
                    <div className="text-[11px] text-blue-900 bg-blue-50/80 border border-blue-200/80 p-2.5 rounded-xl flex items-start space-x-2">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Płatność za {payModalCycles} okresy z góry:</span>
                        <span>
                          Obejmuje: {coveredPeriodsPreview.join(' + ')}. Kolejny termin płatności przesunie się na{' '}
                          <strong>{nextDuePreview}</strong>.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Kwota i ewentualny stan licznika */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Kwota do zapłaty (PLN):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={payModalAmount}
                      onChange={(e) => setPayModalAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                      PLN
                    </span>
                  </div>
                </div>

                {bill.meterReading && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-500" />
                      <span>Stan licznika ({bill.meterReading.unit}):</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={`Poprz: ${bill.meterReading.previous || bill.meterReading.current}`}
                      value={payModalMeterCurr}
                      onChange={(e) => setPayModalMeterCurr(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-right"
                    />
                  </div>
                )}
              </div>

              {/* Podsumowanie skutków opłacenia */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Okres rozliczeniowy:</span>
                  <span className="font-semibold text-slate-800">
                    {coveredPeriodsPreview.join(' + ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Zapis w transakcjach:</span>
                  <span className="font-semibold text-emerald-700">
                    Wydatek z datą: {payModalDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Kolejny cykl płatności:</span>
                  <span className="font-semibold text-slate-800">
                    {nextDuePreview
                      ? `${nextDuePreview} (${bill.billingCycle})`
                      : 'Rachunek jednorazowy (zakończony)'}
                  </span>
                </div>
              </div>

              {/* Opcja przeniesienia zaległości / kumulacji */}
              {bill.billingCycle !== 'jednorazowo' && (
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-start space-x-2">
                    <Layers className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950 block">
                        Nie opłacasz w tym terminie?
                      </span>
                      <span className="text-[11px] text-amber-800">
                        Przełóż i skumuluj ten rachunek z kolejnym okresem rozliczeniowym.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenRolloverModal(bill)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs rounded-xl shadow-2xs whitespace-nowrap transition-colors flex items-center justify-center space-x-1 shrink-0"
                  >
                    <FastForward className="w-3.5 h-3.5 text-amber-700" />
                    <span>Przełóż / Kumuluj</span>
                  </button>
                </div>
              )}

              {/* Dolne przyciski */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalBill(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={!isValidAmount || !payModalDate}
                  onClick={handleConfirmPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Zatwierdź opłatę ({isValidAmount ? numAmount.toFixed(2) : '0.00'} PLN)
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal przeniesienia i kumulacji na kolejny miesiąc */}
      {rolloverModalBill && (() => {
        const bill = rolloverModalBill;
        const meta = getServiceMeta(bill.serviceType);
        const ServiceIcon = meta.icon;
        const baseAmt =
          bill.baseAmount || (bill.amount / Math.max(1, (bill.rolloverCount || 0) + 1));
        const currentPeriod = getBillingPeriodName(bill.dueDate);
        const nextDefaultDue = calculateNextDueDate(bill.dueDate, bill.billingCycle, 1);
        const targetPeriod = getBillingPeriodName(rolloverNewDate || nextDefaultDue);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-700">
                    <FastForward className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      Przełożenie i kumulacja rachunku
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bill.name} • {bill.provider}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRolloverModalBill(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Zamknij"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wyjaśnienie */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Kumulacja rachunku na kolejny okres:</p>
                  <p className="text-amber-900/90 text-[11px] leading-relaxed">
                    Jeśli rachunek nie został opłacony w bieżącym terminie ({currentPeriod}), możesz przenieść zaległość na kolejny miesiąc ({targetPeriod}). Kwota zostanie skumulowana z kolejnym okresem rozliczeniowym.
                  </p>
                </div>
              </div>

              {/* Wybór trybu: Kumulacja kwoty czy tylko odroczenie terminu */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Wybierz sposób przełożenia:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRolloverMode('accumulate');
                      setRolloverAmount((bill.amount + baseAmt).toFixed(2));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      rolloverMode === 'accumulate'
                        ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Layers
                        className={`w-4 h-4 ${
                          rolloverMode === 'accumulate' ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold ${
                          rolloverMode === 'accumulate' ? 'text-amber-950' : 'text-slate-800'
                        }`}
                      >
                        Kumuluj kwoty (2x)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Dodaje koszt kolejnego cyklu: bieżąca ({bill.amount.toFixed(2)} zł) + kolejny ({baseAmt.toFixed(2)} zł) ={' '}
                      {(bill.amount + baseAmt).toFixed(2)} zł
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRolloverMode('defer_only');
                      setRolloverAmount(bill.amount.toFixed(2));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      rolloverMode === 'defer_only'
                        ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Clock
                        className={`w-4 h-4 ${
                          rolloverMode === 'defer_only' ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold ${
                          rolloverMode === 'defer_only' ? 'text-amber-950' : 'text-slate-800'
                        }`}
                      >
                        Tylko odrocz termin
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Przesuwa jedynie datę ważności, zachowując obecną kwotę do zapłaty ({bill.amount.toFixed(2)} zł)
                    </p>
                  </button>
                </div>
              </div>

              {/* Nowy termin płatności */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Nowy termin płatności (kolejny okres):</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Dotychczas: {bill.dueDate}
                  </span>
                </div>

                <input
                  type="date"
                  value={rolloverNewDate}
                  onChange={(e) => setRolloverNewDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition-all"
                />

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setRolloverNewDate(nextDefaultDue)}
                    className="px-2.5 py-1 text-xs rounded-lg font-semibold border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  >
                    Kolejny cykl wg umowy ({nextDefaultDue})
                  </button>
                </div>
              </div>

              {/* Nowa kwota po kumulacji z możliwością ręcznej korekty */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Nowa łączna kwota do zapłaty (PLN):</span>
                  <span className="text-[11px] text-slate-400 font-normal">możesz edytować</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={rolloverAmount}
                    onChange={(e) => setRolloverAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-black text-amber-950 bg-amber-50/50 border border-amber-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-amber-700">
                    PLN
                  </span>
                </div>
              </div>

              {/* Notatka / Komentarz do kumulacji */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Notatka / powód przeniesienia:
                </label>
                <input
                  type="text"
                  value={rolloverNote}
                  onChange={(e) => setRolloverNote(e.target.value)}
                  placeholder="np. Skumulowano opłatę za wrzesień z październikiem"
                  className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Podsumowanie */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Dotychczasowy okres:</span>
                  <span className="font-semibold text-slate-700 line-through">{currentPeriod}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Docelowy okres rozliczeniowy:</span>
                  <span className="font-bold text-amber-800">{targetPeriod}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nowy termin płatności:</span>
                  <span className="font-bold text-slate-800">{rolloverNewDate}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-semibold">Do zapłaty łącznie:</span>
                  <span className="font-black text-sm text-amber-800">
                    {parseFloat(rolloverAmount || '0').toFixed(2)} PLN
                  </span>
                </div>
              </div>

              {/* Dolne przyciski */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRolloverModalBill(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRollover}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Zatwierdź przełożenie ({parseFloat(rolloverAmount || '0').toFixed(2)} PLN)
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Bill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Dodaj nowy rachunek domowy</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="space-y-3.5">
              {/* Pricing Type Selection: Fixed vs Variable */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Charakter opłaty *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingType('fixed')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${
                      pricingType === 'fixed'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <span>🔒 Opłata stała</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Czynsz, internet, śmieci (jednakowa kwota co miesiąc)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('variable')}
                    className={`p-3 rounded-xl border text-left flex flex-col transition-all ${
                      pricingType === 'variable'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <span>⚡ Opłata zmienna</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Prąd, gaz, woda (zmienna kwota lub licznik co cykl)
                    </span>
                  </button>
                </div>
              </div>

              {/* Name & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nazwa rachunku *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Tauron Prąd, Czynsz wrzesień, Internet..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {pricingType === 'fixed' ? 'Kwota stała (PLN) *' : 'Kwota bieżąca (PLN) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Service Type & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rodzaj usługi *
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => {
                      const val = e.target.value as UtilityServiceType;
                      setServiceType(val);
                      if (val === 'woda' || val === 'gaz') setMeterUnit('m³');
                      if (val === 'prąd') setMeterUnit('kWh');
                      if (val === 'ogrzewanie') setMeterUnit('GJ');
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-medium"
                  >
                    <option value="prąd">⚡ Prąd elektryczny</option>
                    <option value="gaz">🔥 Gaz ziemny</option>
                    <option value="woda">💧 Woda i ścieki</option>
                    <option value="czynsz">🏢 Czynsz administracyjny</option>
                    <option value="internet">🌐 Internet / TV</option>
                    <option value="ogrzewanie">🌡️ Ogrzewanie CO</option>
                    <option value="śmieci">🗑️ Wywóz śmieci</option>
                    <option value="telefon">📱 Telefon / GSM</option>
                    <option value="subskrypcje">📺 Subskrypcje</option>
                    <option value="inne">📄 Inna usługa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Termin płatności *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cykliczność rachunku
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-medium"
                >
                  <option value="miesięcznie">Miesięcznie</option>
                  <option value="co 2 miesiące">Co 2 miesiące</option>
                  <option value="kwartalnie">Kwartalnie</option>
                  <option value="rocznie">Rocznie</option>
                  <option value="jednorazowo">Jednorazowo</option>
                </select>
              </div>

              {/* Initial Status & Auto-expense choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status przy dodaniu rachunku
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInitialStatus('pending')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      initialStatus === 'pending'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-700">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Do zapłaty (Oczekujący)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Przypomnij w terminie ({dueDate})
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInitialStatus('paid')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      initialStatus === 'paid'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Już opłacony</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Wpisz od razu do Wydatków
                    </p>
                  </button>
                </div>
              </div>

              {/* Payment Date (only if already paid) */}
              {initialStatus === 'paid' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Data opłacenia rachunku *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
                  />
                  <p className="text-[11px] text-emerald-700">
                    Transakcja wydatku w budżecie domowym zostanie zaksięgowana z tą wybraną datą.
                  </p>
                </div>
              )}

              {/* Meter Readings Option */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={hasMeterReading}
                    onChange={(e) => setHasMeterReading(e.target.checked)}
                    className="rounded-sm text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Rejestruj odczyt licznika (prąd, woda, gaz, ciepło)
                  </span>
                </label>

                {hasMeterReading && (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Poprzedni stan
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={meterPrev}
                        onChange={(e) => setMeterPrev(e.target.value)}
                        placeholder="np. 1420"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Bieżący stan
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={meterCurr}
                        onChange={(e) => setMeterCurr(e.target.value)}
                        placeholder="np. 1565"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Jednostka
                      </label>
                      <input
                        type="text"
                        value={meterUnit}
                        onChange={(e) => setMeterUnit(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notatki (np. nr konta, zlecenie stałe)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="np. automatyczny przelew 10 dnia miesiąca"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Zapisz rachunek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
