export type TransactionType = 'expense' | 'income';

export type TabType = 'dashboard' | 'scanner' | 'shopping' | 'bills' | 'transactions' | 'limits' | 'reports' | 'mortgage';

export type ExpenseCategory =
  | 'Jedzenie i artykuły spożywcze'
  | 'Remont i dom'
  | 'Dla kotów i zwierząt'
  | 'Rachunki i media'
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
  | 'Pożyczka / Kredyt'
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
  type: 'bill_due' | 'bill_overdue' | 'budget_warning' | 'budget_exceeded' | 'activity' | 'info';
  date: string;
  read: boolean;
  relatedId?: string;
  actionLink?: string;
  authorName?: string;
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

export interface HouseholdMember {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'member';
  joinedAt: string;
  isCurrentUser?: boolean;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
  members: HouseholdMember[];
  syncStatus: 'synced' | 'syncing' | 'offline';
  cloudProvider?: 'firebase' | 'local';
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

