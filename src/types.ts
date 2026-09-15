export type TransactionType = 'expense' | 'income';

export type TabType =
  | 'dashboard'
  | 'scanner'
  | 'shopping'
  | 'bills'
  | 'transactions'
  | 'limits'
  | 'reports'
  | 'debts'
  | 'mortgage';

export type ExpenseCategory =
  | 'Jedzenie i artykuły spożywcze'
  | 'Remont i dom'
  | 'Dla kotów i zwierząt'
  | 'Rachunki i media'
  | 'Zobowiązania i pożyczki'
  | 'Kredyty i pożyczki'
  | 'Zdrowie i kosmetyki'
  | 'Transport i paliwo'
  | 'Rozrywka i hobby'
  | 'Odzież i obuwie'
  | 'Edukacja i książki'
  | 'Inne wydatki';

export type IncomeCategory =
  | 'Wypłata z etatu'
  | 'Premia / Bonus'
  | 'Gotówka'
  | 'Zobowiązania i pożyczki'
  | 'Zwrot (zakupy, podatki)'
  | 'Freelance / Zlecenia'
  | 'Świadczenia / 800+'
  | 'Sprzedaż (Vinted, OLX)'
  | 'Prezent / Darowizna'
  | 'Odsetki / Inwestycje'
  | 'Alimenty'
  | 'Inne wpływy';

export interface ReceiptItemDetail {
  name: string;
  price: number;
  quantity?: number;
  type?: TransactionType; // 'expense' | 'income'
  category: ExpenseCategory | IncomeCategory | string;
  date?: string; // Indywidualna data pozycji z paragonu / wyciągu (YYYY-MM-DD)
  notes?: string;
  selected?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  title: string;
  comment?: string;
  isRecurring?: boolean;
  receiptId?: string;
  billId?: string; // ID powiązanego rachunku
  billPaymentHistoryId?: string; // ID powiązanego wpisu w historii rachunku
  billPeriodDueDate?: string; // Termin płatności cyklu, którego dotyczy ta transakcja
  mortgageId?: string; // ID powiązanego kredytu
  mortgagePaymentType?: 'regular' | 'overpayment'; // Typ wpłaty: rata standardowa lub nadpłata
  debtId?: string; // ID powiązanego zadłużenia / pożyczki
  debtAction?: 'borrow' | 'repay_borrowed' | 'lend' | 'receive_lent'; // Akcja zadłużenia
  debtCounterparty?: string; // Podmiot / osoba powiązana
  principalAmount?: number; // Kwota spłaconego kapitału (pomniejszająca saldo zadłużenia)
  interestAmount?: number; // Kwota odsetek bankowych
  isBalanceRollover?: boolean; // Flaga: transakcja przesunięcia bilansu z innego miesiąca
  rolloverFromMonth?: string; // Miesiąc źródłowy (YYYY-MM), z którego przesunięto bilans
  rolloverToMonth?: string; // Miesiąc docelowy (YYYY-MM), na który przesunięto bilans
  receiptItems?: ReceiptItemDetail[];
  receiptStoreName?: string;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  estimatedPrice?: number;
  quantity: number;
  unit: string; // np. 'szt.', 'kg', 'opak.'
  isCompleted: boolean;
  category: string;
  notes?: string;
  addedToExpenses?: boolean;
  assignedTo?: string;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  category: string; // np. "Obiad", "Remont", "Koty", "Chemia"
  icon: string;
  color: string;
  description?: string;
  priority?: number; // Wyższy priorytet = wyżej na liście (domyślnie 0)
  isHidden?: boolean; // Czy lista jest tymczasowo ukryta z widoku głównego
  createdAt: string;
}

export type UtilityServiceType =
  | 'woda'
  | 'prąd'
  | 'gaz'
  | 'czynsz'
  | 'internet'
  | 'ogrzewanie'
  | 'śmieci'
  | 'telefon'
  | 'subskrypcje'
  | 'kredyt'
  | 'inne';

export interface MeterReading {
  previous: number;
  current: number;
  unit: string; // 'm³', 'kWh', 'GJ'
  readingDate?: string;
}

export type BillPricingType = 'fixed' | 'variable';

export interface BillPaymentHistoryItem {
  id: string;
  amount: number;
  paidDate: string; // YYYY-MM-DD
  billingPeriod?: string;
  notes?: string;
  meterReading?: MeterReading;
  cycleCount?: number; // np. 2 jeśli opłacono za 2 okresy rozliczeniowe
  isRollover?: boolean; // true jeśli to wpis o kumulacji / przeniesieniu na kolejny okres
  periodDueDate?: string; // Pierwotny termin płatności cyklu, którego dotyczy wpis (YYYY-MM-DD)
  transactionId?: string; // ID powiązanej transakcji w wydatkach
}

export interface Bill {
  id: string;
  name: string;
  serviceType: UtilityServiceType;
  provider: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  billingCycle: 'miesięcznie' | 'co 2 miesiące' | 'kwartalnie' | 'rocznie' | 'jednorazowo';
  pricingType?: BillPricingType; // 'fixed' (stała) | 'variable' (zmienna)
  status: 'pending' | 'paid' | 'overdue';
  paymentDate?: string;
  lastPaidAmount?: number;
  meterReading?: MeterReading;
  notes?: string;
  autoExpenseId?: string;
  previousDueDate?: string; // Poprzedni termin przed opłaceniem cyklu
  paymentHistory?: BillPaymentHistoryItem[];
  accumulatedDebt?: number; // Skumulowana kwota z nieopłaconych poprzednich okresów
  rolloverCount?: number; // Liczba przeniesionych / skumulowanych okresów
  baseAmount?: number; // Kwota bazowa pojedynczego okresu przed kumulacją
  debtId?: string; // Powiązane zobowiązanie (np. kredyt hipoteczny, pożyczka)
  createdAt: string;
}

export interface BudgetLimit {
  id: string;
  category: string;
  monthlyLimit: number;
  notifyAtPercent?: number; // default 80%
  color: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'bill_due'
    | 'bill_overdue'
    | 'budget_warning'
    | 'budget_exceeded'
    | 'transaction_added'
    | 'shopping_added'
    | 'item_bought'
    | 'bill_added'
    | 'item_restored'
    | 'activity'
    | 'info';
  date: string;
  read: boolean;
  relatedId?: string;
  targetTab?: TabType;
  actionLink?: string;
  authorName?: string;
  authorId?: string;
}

export interface ActivityLogEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'sync' | 'household';
  entityType: 'transaction' | 'shopping_item' | 'bill' | 'budget_limit' | 'shopping_list' | 'debt' | 'household' | 'system';
  title: string;
  description: string;
  authorName: string;
  userName?: string;
  timestamp: string; // ISO date string
  relatedId?: string;
  entityId?: string;
  snapshot?: any;
  deletedPayload?: {
    type: 'transaction' | 'shopping_item' | 'bill' | 'budget_limit' | 'shopping_list' | 'debt';
    data: any;
  };
  restored?: boolean;
}

export interface ReceiptScanResult {
  storeName: string;
  date: string;
  totalAmount: number;
  currency?: string;
  receiptNumber?: string;
  dominantCategory: string;
  summary?: string;
  items: ReceiptItemDetail[];
}

export interface FinancialAdvice {
  financialHealth: 'Doskonała' | 'Dobra' | 'Umiarkowana' | 'Wymaga uwagi';
  savingsRatePercent: number;
  alerts: string[];
  actionableTips: string[];
  summary: string;
}

export interface PendingJoinRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  requestedAt: string;
}

export interface HouseholdMember {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'member';
  joinedAt: string;
  isCurrentUser?: boolean;
}

export interface HouseholdPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  userName: string;
  device?: string;
  updatedAt: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
  members: HouseholdMember[];
  pendingRequests?: PendingJoinRequest[];
  syncStatus: 'synced' | 'syncing' | 'offline';
  cloudProvider?: 'firebase' | 'local';
  pushSubscriptions?: HouseholdPushSubscription[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  householdId?: string;
  isLoggedIn: boolean;
}

export interface MortgagePaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'regular' | 'overpayment'; // rata standardowa lub nadpłata
  totalAmount: number; // łączna kwota płatności
  principalAmount: number; // część kapitałowa (zmniejsza saldo zadłużenia)
  interestAmount: number; // część odsetkowa (koszt banku)
  remainingPrincipalAfter: number; // kapitał pozostały do spłaty po tej transakcji
  notes?: string;
  transactionId?: string; // powiązana transakcja w budżecie
  isGracePeriod?: boolean; // czy płatność w okresie karencji (100% odsetki, 0 zł kapitału)
}

export interface MortgageLoan {
  id: string;
  name: string; // np. "Kredyt hipoteczny - Mieszkanie"
  bankName: string; // np. "PKO Bank Polski", "mBank", "Santander", "ING"
  totalLoanAmount: number; // Całkowita pierwotna kwota kredytu (np. 409 000 zł)
  remainingPrincipal: number; // Aktualny pozostały kapitał do spłaty (np. 403 000 zł)
  initialPaidPrincipal: number; // Spłacony kapitał przed wdrożeniem do aplikacji (np. 6 000 zł)
  monthlyPayment: number; // Aktualna rata miesięczna (np. 2 800 zł)
  interestRate: number; // Oprocentowanie roczne w % (np. 7.45%)
  loanTermYears: number; // Okres w latach (np. 29 lat)
  startDate: string; // Data uruchomienia kredytu (YYYY-MM-DD)
  repaymentStartDate?: string; // Data rozpoczęcia spłaty rat (YYYY-MM-DD)
  gracePeriodMonths?: number; // Okres karencji w spłacie kapitału (w miesiącach)
  gracePeriodEndDate?: string; // Data zakończenia karencji (YYYY-MM-DD)
  paymentDayOfMonth: number; // Dzień miesiąca płatności raty (np. 10)
  rateType: 'equal' | 'decreasing'; // równe (annuitetowe) lub malejące
  wiborOrMarginNotes?: string; // np. "WIBOR 3M + 1.85% marża banku"
  paymentsHistory: MortgagePaymentRecord[];
  createdAt: string;
}

export type DebtType = 'borrowed' | 'lent';
// 'borrowed': Zobowiązanie / Moje długi (ja pożyczyłem i muszę oddać)
// 'lent': Pożyczone innym / Do odzyskania (ktoś pożyczył ode mnie i ma mi oddać)

export type DebtCategory =
  | 'kredyt_bankowy'
  | 'pozyczka_prywatna'
  | 'pozyczka_rodzina'
  | 'chwilowka'
  | 'inne';

export interface DebtPaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'regular' | 'overpayment' | 'settlement';
  principalAmount?: number;
  interestAmount?: number;
  remainingAfter: number;
  notes?: string;
  transactionId?: string; // Powiązana transakcja w budżecie
}

export interface DebtItem {
  id: string;
  type: DebtType; // 'borrowed' (Muszę oddać) | 'lent' (Do odzyskania)
  category: DebtCategory;
  name: string; // np. "Kredyt hipoteczny", "Pożyczka od Tomka", "Pożyczyłem Markowi"
  counterparty: string; // Kto / Bank / Znajomy, np. "PKO BP", "Tomek", "Marek"
  initialAmount: number; // Całkowita kwota zadłużenia
  totalAmount?: number; // Alias całkowitej kwoty
  currentRemaining: number; // Pozostało do oddania lub do odzyskania
  paidAmount: number; // Spłacono lub odzyskano
  startDate: string; // YYYY-MM-DD
  dueDate?: string; // Termin całkowitego zwrotu (YYYY-MM-DD)
  status: 'active' | 'settled'; // 'active' (w trakcie) | 'settled' (rozliczone)
  notes?: string;

  // Opcjonalne zaawansowane parametry kredytowe (dla kredytów bankowych):
  isBankLoan?: boolean;
  bankName?: string; // Nazwa banku
  loanAccountNumber?: string; // Numer konta do spłaty
  monthlyPayment?: number; // Miesięczna rata
  interestRate?: number; // Oprocentowanie roczne % (całkowite)
  marginRate?: number; // Marża banku %
  referenceRate?: number; // Stopa bazowa (WIBOR/WIRON) %
  referenceRateType?: string; // 'WIBOR 3M' | 'WIBOR 6M' | 'WIRON' | 'Stałe' | 'Inne'
  loanTermYears?: number; // Czas trwania w latach
  paymentDayOfMonth?: number; // Dzień miesiąca pobrania raty
  gracePeriodMonths?: number; // Okres karencji w miesiącach
  gracePeriodEndDate?: string; // Data zakończenia karencji
  rateType?: 'equal' | 'decreasing'; // Typ rat: równe / malejące
  wiborOrMarginNotes?: string;
  insuranceMonthly?: number; // Ubezpieczenie pomostowe / na życie / nieruchomości (miesięcznie)
  overpaymentCommission?: number; // Prowizja za wcześniejszą spłatę w %
  overpaymentCommissionYears?: number; // Przez ile pierwszych lat obowiązuje prowizja

  paymentsHistory: DebtPaymentRecord[];
  createdAt: string;
  updatedAt?: string;
}


