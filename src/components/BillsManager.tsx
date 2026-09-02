import React, { useState } from 'react';
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
  CreditCard,
  Edit3,
} from 'lucide-react';
import { Bill, UtilityServiceType, Transaction, BillPricingType } from '../types';
import { calculateNextDueDate, getBillingPeriodName } from '../utils/billCycle';

interface BillsManagerProps {
  bills: Bill[];
  onAddBill: (bill: Omit<Bill, 'id' | 'createdAt'>) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onDeleteBill: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  pushEnabled: boolean;
  onTogglePush: (enabled: boolean) => void;
}

export const BillsManager: React.FC<BillsManagerProps> = ({
  bills,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onAddTransaction,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [filterPricing, setFilterPricing] = useState<'all' | 'fixed' | 'variable'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchPayModal, setShowBatchPayModal] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Variable bills inline edits state: billId -> { amount: string, meterCurr: string }
  const [variableEdits, setVariableEdits] = useState<
    Record<string, { amount: string; meterCurr?: string }>
  >({});

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
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billingCycle, setBillingCycle] = useState<Bill['billingCycle']>('miesięcznie');
  const [notes, setNotes] = useState('');
  const [hasMeterReading, setHasMeterReading] = useState(false);
  const [meterPrev, setMeterPrev] = useState('');
  const [meterCurr, setMeterCurr] = useState('');
  const [meterUnit, setMeterUnit] = useState('kWh');

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

  // Filter bills
  const filteredBills = bills.filter((b) => {
    const matchesType = filterType === 'all' || b.serviceType === filterType;
    const matchesPricing =
      filterPricing === 'all' ||
      (filterPricing === 'fixed' && (b.pricingType === 'fixed' || !b.pricingType)) ||
      (filterPricing === 'variable' && b.pricingType === 'variable');

    let matchesStatus = true;
    if (filterStatus === 'paid') matchesStatus = b.status === 'paid';
    if (filterStatus === 'pending') matchesStatus = b.status === 'pending';
    if (filterStatus === 'overdue') {
      const d = new Date(b.dueDate);
      d.setHours(0, 0, 0, 0);
      matchesStatus = b.status !== 'paid' && d.getTime() < today.getTime();
    }
    return matchesType && matchesPricing && matchesStatus;
  });

  // Calculate totals
  const pendingBills = bills.filter((b) => b.status !== 'paid');
  const totalPendingAmount = pendingBills.reduce((s, b) => s + b.amount, 0);
  const paidBills = bills.filter((b) => b.status === 'paid');
  const totalPaidAmount = paidBills.reduce((s, b) => s + b.amount, 0);

  // Pending fixed bills for batch quick pay
  const pendingFixedBills = pendingBills.filter((b) => b.pricingType === 'fixed' || !b.pricingType);
  const totalPendingFixedAmount = pendingFixedBills.reduce((s, b) => s + b.amount, 0);

  /**
   * Opłacenie rachunku stałego (1 kliknięcie)
   */
  const handlePayFixedBill = (bill: Bill) => {
    const payDate = new Date().toISOString().split('T')[0];
    const periodName = getBillingPeriodName(bill.dueDate);

    // 1. Zapisz transakcję w wydatkach
    onAddTransaction({
      type: 'expense',
      amount: bill.amount,
      category: 'Rachunki i media',
      date: payDate,
      title: `Rachunek: ${bill.name}`,
      comment: `Opłacono opłatę stałą (${bill.provider}) za okres ${periodName}.`,
    });

    const newHistoryItem = {
      id: `hist-${Date.now()}`,
      amount: bill.amount,
      paidDate: payDate,
      billingPeriod: periodName,
      notes: 'Opłata stała uregulowana',
    };

    const updatedHistory = [newHistoryItem, ...(bill.paymentHistory || [])];

    // 2. Obsługa cykliczności
    if (bill.billingCycle === 'jednorazowo') {
      onUpdateBill(bill.id, {
        status: 'paid',
        paymentDate: payDate,
        lastPaidAmount: bill.amount,
        paymentHistory: updatedHistory,
      });
      showToast(`Opłacono jednorazowy rachunek "${bill.name}" (${bill.amount.toFixed(2)} PLN).`);
    } else {
      const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle);
      onUpdateBill(bill.id, {
        status: 'pending',
        dueDate: nextDue,
        paymentDate: payDate,
        lastPaidAmount: bill.amount,
        paymentHistory: updatedHistory,
      });
      showToast(
        `Opłacono rachunek stały "${bill.name}" (${bill.amount.toFixed(2)} PLN). Nowy termin: ${nextDue} (${bill.billingCycle}).`
      );
    }
  };

  /**
   * Opłacenie rachunku zmiennego (z wprowadzoną nową kwotą lub odczytem)
   */
  const handlePayVariableBill = (bill: Bill) => {
    const edit = variableEdits[bill.id];
    const customAmountStr = edit?.amount !== undefined ? edit.amount : bill.amount.toString();
    const parsedAmount = parseFloat(customAmountStr);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Wprowadź prawidłową kwotę rachunku większą od 0.');
      return;
    }

    const payDate = new Date().toISOString().split('T')[0];
    const periodName = getBillingPeriodName(bill.dueDate);

    // Zaktualizowany odczyt licznika jeśli podano
    let updatedMeter = bill.meterReading;
    if (edit?.meterCurr && !isNaN(parseFloat(edit.meterCurr))) {
      const currVal = parseFloat(edit.meterCurr);
      updatedMeter = {
        previous: bill.meterReading?.current || 0,
        current: currVal,
        unit: bill.meterReading?.unit || 'kWh',
        readingDate: payDate,
      };
    }

    // 1. Zapisz transakcję
    onAddTransaction({
      type: 'expense',
      amount: parsedAmount,
      category: 'Rachunki i media',
      date: payDate,
      title: `Rachunek: ${bill.name}`,
      comment: `Opłacono rachunek zmienny (${bill.provider}) za okres ${periodName}: ${parsedAmount.toFixed(2)} PLN.${
        updatedMeter ? ` Stan licznika: ${updatedMeter.current} ${updatedMeter.unit}.` : ''
      }`,
    });

    const newHistoryItem = {
      id: `hist-${Date.now()}`,
      amount: parsedAmount,
      paidDate: payDate,
      billingPeriod: periodName,
      meterReading: updatedMeter,
      notes: `Opłata zmienna zaktualizowana i opłacona`,
    };

    const updatedHistory = [newHistoryItem, ...(bill.paymentHistory || [])];

    // 2. Obsługa cykliczności
    if (bill.billingCycle === 'jednorazowo') {
      onUpdateBill(bill.id, {
        status: 'paid',
        amount: parsedAmount,
        paymentDate: payDate,
        lastPaidAmount: parsedAmount,
        meterReading: updatedMeter,
        paymentHistory: updatedHistory,
      });
      showToast(`Opłacono rachunek "${bill.name}" na kwotę ${parsedAmount.toFixed(2)} PLN.`);
    } else {
      const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle);
      onUpdateBill(bill.id, {
        status: 'pending',
        amount: parsedAmount, // Zaktualizowana nowa kwota jako baza na kolejny cykl
        dueDate: nextDue,
        paymentDate: payDate,
        lastPaidAmount: parsedAmount,
        meterReading: updatedMeter,
        paymentHistory: updatedHistory,
      });
      showToast(
        `Opłacono ${bill.name} (${parsedAmount.toFixed(2)} PLN). Cykl przesunięty na: ${nextDue}.`
      );
    }

    // Wyczyszczenie stanu edycji dla tego rachunku
    setVariableEdits((prev) => {
      const copy = { ...prev };
      delete copy[bill.id];
      return copy;
    });
  };

  /**
   * Szybkie zbiorcze opłacenie wszystkich oczekujących rachunków stałych
   */
  const handleBatchPayFixed = () => {
    if (pendingFixedBills.length === 0) return;

    const payDate = new Date().toISOString().split('T')[0];
    let totalPaid = 0;

    pendingFixedBills.forEach((bill) => {
      const periodName = getBillingPeriodName(bill.dueDate);
      totalPaid += bill.amount;

      onAddTransaction({
        type: 'expense',
        amount: bill.amount,
        category: 'Rachunki i media',
        date: payDate,
        title: `Rachunek: ${bill.name}`,
        comment: `Szybka płatność stała (${bill.provider}) za okres ${periodName}`,
      });

      const newHistoryItem = {
        id: `hist-${Date.now()}-${bill.id}`,
        amount: bill.amount,
        paidDate: payDate,
        billingPeriod: periodName,
        notes: 'Szybkie opłacenie zbiorcze',
      };
      const updatedHistory = [newHistoryItem, ...(bill.paymentHistory || [])];

      if (bill.billingCycle === 'jednorazowo') {
        onUpdateBill(bill.id, {
          status: 'paid',
          paymentDate: payDate,
          lastPaidAmount: bill.amount,
          paymentHistory: updatedHistory,
        });
      } else {
        const nextDue = calculateNextDueDate(bill.dueDate, bill.billingCycle);
        onUpdateBill(bill.id, {
          status: 'pending',
          dueDate: nextDue,
          paymentDate: payDate,
          lastPaidAmount: bill.amount,
          paymentHistory: updatedHistory,
        });
      }
    });

    setShowBatchPayModal(false);
    showToast(
      `Pomyślnie opłacono ${pendingFixedBills.length} stałych rachunków na łączną kwotę ${totalPaid.toFixed(2)} PLN!`
    );
  };

  /**
   * Cofnięcie statusu / powrót do oczekujących
   */
  const handleTogglePending = (bill: Bill) => {
    if (bill.status === 'paid') {
      onUpdateBill(bill.id, { status: 'pending', paymentDate: undefined });
      showToast(`Rachunek "${bill.name}" oznaczono ponownie jako do zapłaty.`);
    }
  };

  // Handle Create Bill
  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const parsedAmount = parseFloat(amount);
    const payDate = new Date().toISOString().split('T')[0];
    const periodName = getBillingPeriodName(dueDate);

    const meterData =
      hasMeterReading && meterCurr
        ? {
            previous: parseFloat(meterPrev) || 0,
            current: parseFloat(meterCurr),
            unit: meterUnit,
            readingDate: payDate,
          }
        : undefined;

    if (initialStatus === 'paid') {
      // 1. Zapisz transakcję w wydatkach
      onAddTransaction({
        type: 'expense',
        amount: parsedAmount,
        category: 'Rachunki i media',
        date: payDate,
        title: `Rachunek: ${name.trim()}`,
        comment: `Opłacono rachunek (${provider.trim() || name.trim()}) za okres ${periodName}.${
          meterData ? ` Stan licznika: ${meterData.current} ${meterData.unit}.` : ''
        }`,
      });

      const newHistoryItem = {
        id: `hist-${Date.now()}`,
        amount: parsedAmount,
        paidDate: payDate,
        billingPeriod: periodName,
        meterReading: meterData,
        notes: 'Opłacono podczas dodawania rachunku',
      };

      // 2. Dodaj rachunek jako opłacony
      onAddBill({
        name: name.trim(),
        serviceType,
        pricingType,
        provider: provider.trim() || name.trim(),
        amount: parsedAmount,
        dueDate,
        billingCycle,
        status: 'paid',
        paymentDate: payDate,
        lastPaidAmount: parsedAmount,
        paymentHistory: [newHistoryItem],
        notes: notes.trim() || undefined,
        meterReading: meterData,
      });

      showToast(
        `Dodano rachunek "${name.trim()}" i automatycznie zaksięgowano ${parsedAmount.toFixed(
          2
        )} PLN w wydatkach.`
      );
    } else {
      // Oczekujący na opłacenie
      onAddBill({
        name: name.trim(),
        serviceType,
        pricingType,
        provider: provider.trim() || name.trim(),
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
    setPricingType('fixed');
    setInitialStatus('pending');
    setHasMeterReading(false);
    setMeterPrev('');
    setMeterCurr('');
    setShowAddModal(false);
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

      {/* Ultra Clean Header with Green Button & Plus Button only */}
      <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Rachunki i Media
              </h1>
              {pendingBills.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {pendingBills.length} do opłacenia
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Prominent Green Pay Button & Plus Icon Button */}
        <div className="flex items-center space-x-2.5">
          {pendingFixedBills.length > 0 && (
            <button
              onClick={() => setShowBatchPayModal(true)}
              className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center space-x-2 transition-all shadow-xs"
              title="Opłać wszystkie oczekujące rachunki stałe jednym kliknięciem"
            >
              <Check className="w-4 h-4" />
              <span>Opłać stałe ({totalPendingFixedAmount.toFixed(2)} PLN)</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 sm:px-3 sm:py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs font-semibold text-xs sm:text-sm"
            title="Dodaj nowy rachunek"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nowy rachunek</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Do zapłaty (bieżący cykl)</span>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {totalPendingAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {pendingBills.length} oczekujących płatności
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Uregulowane opłaty</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {totalPaidAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {paidBills.length} zakończonych pozycji
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Zarejestrowane opłaty</span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {(totalPendingAmount + totalPaidAmount).toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block font-medium">
              {bills.length} aktywnych usług
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Mode Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Type & Media Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                  filterType === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <meta.icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pricing Mode and Status Filters */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          {/* Pricing type switch */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilterPricing('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPricing === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setFilterPricing('fixed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPricing === 'fixed' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Stałe
            </button>
            <button
              onClick={() => setFilterPricing('variable')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPricing === 'variable' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Zmienne
            </button>
          </div>

          {/* Status switch */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'pending' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Do zapłaty
            </button>
            <button
              onClick={() => setFilterStatus('paid')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'paid' ? 'bg-emerald-600 text-white shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Opłacone
            </button>
          </div>
        </div>
      </div>

      {/* Bills Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBills.map((bill) => {
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
                      onClick={() => onDeleteBill(bill.id)}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                      title="Usuń rachunek"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

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
                            <span className="font-semibold text-slate-800">
                              {item.billingPeriod || item.paidDate}
                            </span>
                            <span className="text-slate-400 block text-[10px]">
                              Zapłacono: {item.paidDate}
                            </span>
                          </div>
                          <span className="font-bold text-emerald-600">
                            {item.amount.toFixed(2)} PLN
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Area: Prominent Green Pay Button */}
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
                ) : isFixed ? (
                  /* FIXED BILL: 1-click Pay Button */
                  <button
                    onClick={() => handlePayFixedBill(bill)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>Opłać {bill.amount.toFixed(2)} PLN</span>
                  </button>
                ) : (
                  /* VARIABLE BILL: Pay with edited amount */
                  <button
                    onClick={() => handlePayVariableBill(bill)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      Opłać {parseFloat(currentVariableEdit.amount || '0').toFixed(2)} PLN
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Batch Pay Fixed Modal */}
      {showBatchPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Zbiorcze opłacenie stałych rachunków
                </h3>
                <p className="text-xs text-slate-500">
                  {pendingFixedBills.length} pozycji do automatycznego uregulowania
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pendingFixedBills.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 block">{b.name}</span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {b.provider} • {b.billingCycle}
                    </span>
                  </div>
                  <span className="font-black text-slate-900">{b.amount.toFixed(2)} PLN</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900">Łączna kwota do pobrania:</span>
              <span className="text-lg font-black text-emerald-700">
                {totalPendingFixedAmount.toFixed(2)} PLN
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchPayModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleBatchPayFixed}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Zatwierdź opłacenie ({totalPendingFixedAmount.toFixed(2)} PLN)</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                    Nazwa rachunku *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Tauron Prąd, Czynsz wrzesień"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dostawca / Firma
                  </label>
                  <input
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="np. Tauron, PGNiG, MPWiK..."
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
                    placeholder="np. 245.50"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
