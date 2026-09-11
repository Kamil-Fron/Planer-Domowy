import { Transaction, TransactionType } from '../types';

export interface SmartTransactionSuggestion {
  title: string;
  category: string;
  type: TransactionType;
  emoji: string;
  count: number;
  typicalAmount?: number;
  lastUsed: number;
  isFrequent: boolean;
}

const STORAGE_KEY = 'house_budget_frequent_transactions';

// Default domestic baselines for expense and income
export const DEFAULT_EXPENSE_SUGGESTIONS: Array<{ title: string; category: string; emoji: string; typicalAmount?: number }> = [
  { title: 'Biedronka / Lidl', category: 'Jedzenie i artykuły spożywcze', emoji: '🛒', typicalAmount: 150 },
  { title: 'Paliwo / Stacja', category: 'Transport i paliwo', emoji: '⛽', typicalAmount: 250 },
  { title: 'Rata kredytu hipotecznego', category: 'Kredyty i pożyczki', emoji: '🏦', typicalAmount: 2800 },
  { title: 'Rossmann / Kosmetyki', category: 'Zdrowie i kosmetyki', emoji: '🧴', typicalAmount: 85 },
  { title: 'Restauracja / Lunch', category: 'Jedzenie i artykuły spożywcze', emoji: '🍽️', typicalAmount: 65 },
  { title: 'Czynsz i opłaty', category: 'Rachunki i media', emoji: '🏠', typicalAmount: 750 },
  { title: 'Apteka i leki', category: 'Zdrowie i kosmetyki', emoji: '💊', typicalAmount: 60 },
  { title: 'Karma i żwirek dla zwierząt', category: 'Dla kotów i zwierząt', emoji: '🐾', typicalAmount: 120 },
  { title: 'Allegro / Domowe zakupy', category: 'Remont i dom', emoji: '📦', typicalAmount: 100 },
];

export const DEFAULT_INCOME_SUGGESTIONS: Array<{ title: string; category: string; emoji: string; typicalAmount?: number }> = [
  { title: 'Wypłata z etatu', category: 'Wypłata z etatu', emoji: '💼', typicalAmount: 6000 },
  { title: 'Premia / Bonus', category: 'Premia / Bonus', emoji: '🎁', typicalAmount: 1000 },
  { title: 'Świadczenie 800+', category: 'Świadczenia / 800+', emoji: '👶', typicalAmount: 800 },
  { title: 'Zlecenie / Freelance', category: 'Freelance / Zlecenia', emoji: '💻', typicalAmount: 1500 },
  { title: 'Zwrot podatku / zakupów', category: 'Zwrot (zakupy, podatki)', emoji: '💸', typicalAmount: 200 },
  { title: 'Sprzedaż Vinted / OLX', category: 'Sprzedaż (Vinted, OLX)', emoji: '🏷️', typicalAmount: 80 },
];

/**
 * Smart emoji resolver based on transaction keywords and categories
 */
export function guessEmojiForTransaction(title: string, category?: string, type?: TransactionType): string {
  const lower = (title || '').toLowerCase();
  const catLower = (category || '').toLowerCase();

  // Mortgages / Loans
  if (
    lower.includes('kredyt') ||
    lower.includes('rata') ||
    lower.includes('hipotek') ||
    lower.includes('pożyczk') ||
    catLower.includes('kredyt')
  ) {
    return '🏦';
  }

  // Fuel & Transport
  if (
    lower.includes('orlen') ||
    lower.includes('paliw') ||
    lower.includes('benzyn') ||
    lower.includes('diesel') ||
    lower.includes('stacj') ||
    lower.includes('shell') ||
    lower.includes('bp ') ||
    lower.includes('circle') ||
    lower.includes('lotos') ||
    catLower.includes('transport')
  ) {
    return '⛽';
  }

  // Supermarkets & Groceries
  if (
    lower.includes('biedronk') ||
    lower.includes('lidl') ||
    lower.includes('dino') ||
    lower.includes('kaufland') ||
    lower.includes('auchan') ||
    lower.includes('carrefour') ||
    lower.includes('żabk') ||
    lower.includes('zabk') ||
    lower.includes('spożywcz')
  ) {
    return '🛒';
  }

  // Restaurant & food out
  if (
    lower.includes('restaurac') ||
    lower.includes('kawiarn') ||
    lower.includes('pizza') ||
    lower.includes('burger') ||
    lower.includes('kebab') ||
    lower.includes('sushi') ||
    lower.includes('lunch') ||
    lower.includes('obiad') ||
    lower.includes('mcdonald') ||
    lower.includes('kfc')
  ) {
    return '🍽️';
  }

  // Pets
  if (
    lower.includes('kot') ||
    lower.includes('pies') ||
    lower.includes('weterynar') ||
    lower.includes('zoolog') ||
    lower.includes('karma') ||
    catLower.includes('zwierz')
  ) {
    return '🐾';
  }

  // Pharmacy & Health
  if (
    lower.includes('rossmann') ||
    lower.includes('hebe') ||
    lower.includes('aptek') ||
    lower.includes('lekarz') ||
    lower.includes('stomatolog') ||
    lower.includes('dentyst') ||
    lower.includes('badani') ||
    catLower.includes('zdrowie')
  ) {
    return '💊';
  }

  // Housing & Bills
  if (
    lower.includes('czynsz') ||
    lower.includes('wynajem') ||
    lower.includes('spółdziel') ||
    lower.includes('wspólnot') ||
    lower.includes('mieszkani')
  ) {
    return '🏠';
  }

  // Utilities
  if (
    lower.includes('prąd') ||
    lower.includes('prad') ||
    lower.includes('tauron') ||
    lower.includes('pge') ||
    lower.includes('enea') ||
    lower.includes('gaz') ||
    lower.includes('pgnig') ||
    lower.includes('woda') ||
    lower.includes('ogrzewan')
  ) {
    return '⚡';
  }

  // Internet & telecom
  if (
    lower.includes('internet') ||
    lower.includes('światłowód') ||
    lower.includes('orange') ||
    lower.includes('play') ||
    lower.includes('plus') ||
    lower.includes('t-mobile') ||
    lower.includes('telefon')
  ) {
    return '📶';
  }

  // Packages & online shopping
  if (
    lower.includes('allegro') ||
    lower.includes('amazon') ||
    lower.includes('inpost') ||
    lower.includes('paczkomat') ||
    lower.includes('kurier') ||
    lower.includes('temu') ||
    lower.includes('shein')
  ) {
    return '📦';
  }

  // Entertainment / Subscriptions
  if (
    lower.includes('netflix') ||
    lower.includes('spotify') ||
    lower.includes('youtube') ||
    lower.includes('disney') ||
    lower.includes('hbo') ||
    lower.includes('kino') ||
    lower.includes('teatr') ||
    lower.includes('steam') ||
    lower.includes('gra')
  ) {
    return '🎬';
  }

  // Income specific
  if (type === 'income' || catLower.includes('wypłata') || catLower.includes('dochód') || catLower.includes('przychód')) {
    if (lower.includes('premia') || lower.includes('bonus')) return '🎁';
    if (lower.includes('800') || lower.includes('świadczen') || lower.includes('dzieck')) return '👶';
    if (lower.includes('zlecen') || lower.includes('freelance') || lower.includes('b2b') || lower.includes('faktur')) return '💻';
    if (lower.includes('zwrot') || lower.includes('podatk')) return '💸';
    if (lower.includes('vinted') || lower.includes('olx') || lower.includes('sprzeda')) return '🏷️';
    return '💼';
  }

  return '💳';
}

interface StoredFrequentTx {
  [key: string]: {
    title: string;
    category: string;
    type: TransactionType;
    count: number;
    totalAmount: number;
    lastUsed: number;
  };
}

function loadFrequentMap(): StoredFrequentTx {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveFrequentMap(map: StoredFrequentTx): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Nie udało się zapisać częstych transakcji:', e);
  }
}

/**
 * Record a transaction usage into frequency history
 */
export function recordTransactionUsage(
  title: string,
  category: string,
  type: TransactionType,
  amount?: number
): void {
  if (!title || !title.trim()) return;
  const cleanTitle = title.trim();
  const key = `${type}_${cleanTitle.toLowerCase()}`;

  const map = loadFrequentMap();
  const existing = map[key];

  const now = Date.now();
  const amt = typeof amount === 'number' && !isNaN(amount) && amount > 0 ? amount : 0;

  if (existing) {
    existing.count += 1;
    existing.lastUsed = now;
    existing.category = category || existing.category;
    if (amt > 0) {
      existing.totalAmount = (existing.totalAmount || 0) + amt;
    }
  } else {
    map[key] = {
      title: cleanTitle,
      category: category || (type === 'income' ? 'Inne wpływy' : 'Inne wydatki'),
      type,
      count: 1,
      totalAmount: amt,
      lastUsed: now,
    };
  }

  saveFrequentMap(map);
}

/**
 * Returns dynamic smart suggestions for transactions (both income and expense)
 */
export function getSmartTransactionSuggestions(
  transactions: Transaction[] = [],
  type: TransactionType = 'expense',
  filterQuery = '',
  limit = 10
): SmartTransactionSuggestion[] {
  const map = loadFrequentMap();

  // Also mine actual transactions in state to enrich counts if local storage was cleared
  const txCounts: Record<string, { count: number; totalAmount: number; lastUsed: number; category: string; title: string }> = {};

  transactions
    .filter((t) => t.type === type && t.title)
    .forEach((t) => {
      const key = `${t.type}_${t.title.trim().toLowerCase()}`;
      const time = new Date(t.date || t.createdAt || Date.now()).getTime();
      if (!txCounts[key]) {
        txCounts[key] = {
          count: 1,
          totalAmount: t.amount || 0,
          lastUsed: time,
          category: t.category,
          title: t.title.trim(),
        };
      } else {
        txCounts[key].count += 1;
        txCounts[key].totalAmount += t.amount || 0;
        if (time > txCounts[key].lastUsed) {
          txCounts[key].lastUsed = time;
        }
      }
    });

  // Merge map + mined transactions
  const merged: Record<string, { title: string; category: string; count: number; totalAmount: number; lastUsed: number }> = {};

  // 1. From stored frequency map
  Object.entries(map).forEach(([key, val]) => {
    if (val.type === type) {
      merged[key] = {
        title: val.title,
        category: val.category,
        count: val.count,
        totalAmount: val.totalAmount || 0,
        lastUsed: val.lastUsed || 0,
      };
    }
  });

  // 2. From actual transactions array
  Object.entries(txCounts).forEach(([key, val]) => {
    if (!merged[key]) {
      merged[key] = {
        title: val.title,
        category: val.category,
        count: val.count,
        totalAmount: val.totalAmount,
        lastUsed: val.lastUsed,
      };
    } else {
      merged[key].count = Math.max(merged[key].count, val.count);
      if (val.lastUsed > merged[key].lastUsed) {
        merged[key].lastUsed = val.lastUsed;
      }
      if (val.totalAmount > merged[key].totalAmount) {
        merged[key].totalAmount = val.totalAmount;
      }
    }
  });

  // Turn into array
  let results: SmartTransactionSuggestion[] = Object.values(merged).map((item) => {
    const avgAmount = item.count > 0 && item.totalAmount > 0 ? Math.round(item.totalAmount / item.count) : undefined;
    return {
      title: item.title,
      category: item.category,
      type,
      emoji: guessEmojiForTransaction(item.title, item.category, type),
      count: item.count,
      typicalAmount: avgAmount,
      lastUsed: item.lastUsed,
      isFrequent: item.count >= 2,
    };
  });

  // Sort primarily by count (frequency), then by recency
  results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastUsed - a.lastUsed;
  });

  // If user has few results, fill up with defaults
  const defaults = type === 'income' ? DEFAULT_INCOME_SUGGESTIONS : DEFAULT_EXPENSE_SUGGESTIONS;
  defaults.forEach((def) => {
    const existing = results.find((r) => r.title.toLowerCase() === def.title.toLowerCase());
    if (!existing) {
      results.push({
        title: def.title,
        category: def.category,
        type,
        emoji: def.emoji,
        count: 0,
        typicalAmount: def.typicalAmount,
        lastUsed: 0,
        isFrequent: false,
      });
    }
  });

  // Filter if query is supplied
  if (filterQuery && filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    results = results.filter(
      (r) => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }

  return results.slice(0, limit);
}
