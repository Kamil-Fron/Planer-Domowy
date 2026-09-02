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
  Bell,
  DollarSign,
  ArrowRight,
  Filter,
  FileText,
  Check,
} from 'lucide-react';
import { Bill, UtilityServiceType, Transaction } from '../types';
import { requestNotificationPermission, sendBrowserPushNotification } from '../utils/notifications';

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
  pushEnabled,
  onTogglePush,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State for new bill
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<UtilityServiceType>('prąd');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billingCycle, setBillingCycle] = useState<Bill['billingCycle']>('miesięcznie');
  const [invoiceNumber, setInvoiceNumber] = useState('');
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
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: Clock,
      };
    } else {
      return {
        text: `Płatność za ${diff} dni (${billDueDate})`,
        color: 'text-slate-700 bg-slate-100 border-slate-200',
        icon: Calendar,
      };
    }
  };

  // Filter bills
  const filteredBills = bills.filter((b) => {
    const matchesType = filterType === 'all' || b.serviceType === filterType;
    let matchesStatus = true;
    if (filterStatus === 'paid') matchesStatus = b.status === 'paid';
    if (filterStatus === 'pending') matchesStatus = b.status === 'pending';
    if (filterStatus === 'overdue') {
      const d = new Date(b.dueDate);
      d.setHours(0, 0, 0, 0);
      matchesStatus = b.status !== 'paid' && d.getTime() < today.getTime();
    }
    return matchesType && matchesStatus;
  });

  // Calculate totals
  const totalPendingAmount = bills
    .filter((b) => b.status !== 'paid')
    .reduce((s, b) => s + b.amount, 0);

  const totalPaidAmount = bills
    .filter((b) => b.status === 'paid')
    .reduce((s, b) => s + b.amount, 0);

  // Handle Mark as Paid
  const handleMarkAsPaid = (bill: Bill) => {
    if (bill.status === 'paid') {
      // Toggle back to pending
      onUpdateBill(bill.id, { status: 'pending', paymentDate: undefined });
    } else {
      const payDate = new Date().toISOString().split('T')[0];
      onUpdateBill(bill.id, { status: 'paid', paymentDate: payDate });

      // Automatically add as expense in budget
      onAddTransaction({
        type: 'expense',
        amount: bill.amount,
        category: 'Rachunki i media',
        date: payDate,
        title: `Rachunek: ${bill.name}`,
        comment: `Opłacono usługę (${bill.provider}). Nr faktury: ${bill.invoiceNumber || 'b.d.'}`,
      });
    }
  };

  // Handle Create Bill
  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    onAddBill({
      name: name.trim(),
      serviceType,
      provider: provider.trim() || name.trim(),
      amount: parseFloat(amount),
      dueDate,
      billingCycle,
      status: 'pending',
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      meterReading:
        hasMeterReading && meterCurr
          ? {
              previous: parseFloat(meterPrev) || 0,
              current: parseFloat(meterCurr),
              unit: meterUnit,
              readingDate: new Date().toISOString().split('T')[0],
            }
          : undefined,
    });

    // Reset Form
    setName('');
    setProvider('');
    setAmount('');
    setInvoiceNumber('');
    setNotes('');
    setHasMeterReading(false);
    setMeterPrev('');
    setMeterCurr('');
    setShowAddModal(false);
  };

  // Handle Push Permission toggle
  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      onTogglePush(true);
      sendBrowserPushNotification('Powiadomienia aktywne!', {
        body: 'Będziesz otrzymywać przypomnienia o zbliżających się rachunkach i limitach budżetowych.',
      });
    } else {
      alert('Powiadomienia zostały zablokowane w ustawieniach przeglądarki.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Rachunki i Media</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Monitoruj opłaty (woda, prąd, gaz, czynsz, internet, śmieci) i stany liczników.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0">
          {!pushEnabled && (
            <button
              onClick={handleEnablePush}
              className="p-2.5 sm:px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs"
              title="Włącz powiadomienia push w przeglądarce"
            >
              <Bell className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Powiadomienia</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj rachunek</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Do zapłaty w tym miesiącu</span>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {totalPendingAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">
              {bills.filter((b) => b.status !== 'paid').length} oczekujących rachunków
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Już opłacone</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {totalPaidAmount.toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">
              {bills.filter((b) => b.status === 'paid').length} uregulowanych opłat
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Łączne zobowiązania</span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {(totalPendingAmount + totalPaidAmount).toFixed(2)} PLN
            </p>
            <span className="text-xs text-slate-400 mt-0.5 block">Wszystkie zarejestrowane usługi</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Service Type Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
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

        <div className="flex items-center space-x-1 w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              filterStatus === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              filterStatus === 'pending' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Do zapłaty
          </button>
          <button
            onClick={() => setFilterStatus('paid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              filterStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Opłacone
          </button>
        </div>
      </div>

      {/* Bills Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBills.map((bill) => {
          const meta = getServiceMeta(bill.serviceType);
          const ServiceIcon = meta.icon;
          const dueInfo = getDueInfo(bill.dueDate, bill.status);
          const DueIcon = dueInfo.icon;

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

                  <button
                    onClick={() => onDeleteBill(bill.id)}
                    className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                    title="Usuń rachunek"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Amount & Due date */}
                <div className="my-4 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900">
                    {bill.amount.toFixed(2)} <span className="text-sm font-semibold text-slate-500">PLN</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium capitalize">
                    {bill.billingCycle}
                  </span>
                </div>

                {/* Due Date Alert Badge */}
                <div
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs ${dueInfo.color}`}
                >
                  <DueIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{dueInfo.text}</span>
                </div>

                {/* Meter Reading details if provided */}
                {bill.meterReading && (
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <Gauge className="w-3.5 h-3.5 text-slate-500" />
                      <span>Stan licznika:</span>
                    </div>
                    <div className="font-semibold text-slate-800">
                      {bill.meterReading.current} {bill.meterReading.unit}
                      {bill.meterReading.previous > 0 && (
                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                          (+{(bill.meterReading.current - bill.meterReading.previous).toFixed(1)})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {bill.notes && (
                  <p className="text-[11px] text-slate-500 mt-2 italic bg-slate-50/50 p-2 rounded-lg">
                    {bill.notes}
                  </p>
                )}
              </div>

              {/* Bottom Action Button */}
              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {bill.invoiceNumber ? `Faktura: ${bill.invoiceNumber}` : 'Brak nr faktury'}
                </span>

                <button
                  onClick={() => handleMarkAsPaid(bill)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    bill.status === 'paid'
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{bill.status === 'paid' ? 'Oznacz jako nieopłacony' : 'Opłać rachunek'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Bill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-slate-900">Dodaj nowy rachunek domowy</h3>
            <p className="text-xs text-slate-500">
              Wprowadź dane opłaty za media, termin płatności oraz ewentualne odczyty liczników.
            </p>

            <form onSubmit={handleSubmitBill} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rodzaj usługi *
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => {
                      setServiceType(e.target.value as UtilityServiceType);
                      if (e.target.value === 'woda' || e.target.value === 'gaz') setMeterUnit('m³');
                      if (e.target.value === 'prąd') setMeterUnit('kWh');
                      if (e.target.value === 'ogrzewanie') setMeterUnit('GJ');
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
                    Kwota (PLN) *
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
                    Cykl rozliczeniowy
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="miesięcznie">Miesięcznie</option>
                    <option value="co 2 miesiące">Co 2 miesiące</option>
                    <option value="kwartalnie">Kwartalnie</option>
                    <option value="rocznie">Rocznie</option>
                    <option value="jednorazowo">Jednorazowo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numer faktury / Identyfikator płatności
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="np. FV/2026/09/TAU-123"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
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
                    Wprowadź stan licznika (prąd, woda, gaz, ciepło)
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
                  Uwagi / Notatki (np. nr konta, zlecenie stałe)
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl"
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
