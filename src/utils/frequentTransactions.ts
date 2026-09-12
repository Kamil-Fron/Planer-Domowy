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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FrequentTxHistoryEntry {
  title: string;
  category: string;
  type: TransactionType;
  timestamps?: number[];
  amounts?: number[];
  count?: number;
  totalAmount?: number;
  lastUsed: number;
}

interface StoredFrequentTx {
  [key: string]: FrequentTxHistoryEntry;
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
 * Record a transaction usage into frequency history (rolling 30-day window)
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
  const cutoff = now - THIRTY_DAYS_MS;
  const amt = typeof amount === 'number' && !isNaN(amount) && amount > 0 ? amount : 0;

  let validTimestamps: number[] = [];
  let validAmounts: number[] = [];

  if (existing?.timestamps && Array.isArray(existing.timestamps)) {
    existing.timestamps.forEach((t, i) => {
      if (typeof t === 'number' && t >= cutoff) {
        validTimestamps.push(t);
        validAmounts.push(existing.amounts?.[i] || 0);
      }
    });
  } else if (existing?.lastUsed && existing.lastUsed >= cutoff) {
    validTimestamps.push(existing.lastUsed);
    validAmounts.push(existing.totalAmount ? existing.totalAmount / (existing.count || 1) : 0);
  }

  // Append new usage
  validTimestamps.push(now);
  validAmounts.push(amt);

  map[key] = {
    title: cleanTitle,
    category: category?.trim() || existing?.category || (type === 'income' ? 'Inne wpływy' : 'Inne wydatki'),
    type,
    timestamps: validTimestamps,
    amounts: validAmounts,
    count: validTimestamps.length,
    totalAmount: validAmounts.reduce((a, b) => a + b, 0),
    lastUsed: now,
  };

  // Clean up completely expired items from storage
  Object.keys(map).forEach((k) => {
    const entry = map[k];
    if (entry.timestamps) {
      const filteredTimes: number[] = [];
      const filteredAmts: number[] = [];
      entry.timestamps.forEach((t, i) => {
        if (t >= cutoff) {
          filteredTimes.push(t);
          filteredAmts.push(entry.amounts?.[i] || 0);
        }
      });
      entry.timestamps = filteredTimes;
      entry.amounts = filteredAmts;
      entry.count = filteredTimes.length;
      entry.totalAmount = filteredAmts.reduce((a, b) => a + b, 0);

      if (filteredTimes.length === 0 && (!entry.lastUsed || entry.lastUsed < cutoff)) {
        delete map[k];
      }
    } else if (entry.lastUsed && entry.lastUsed < cutoff) {
      delete map[k];
    }
  });

  saveFrequentMap(map);
}

/**
 * Returns dynamic smart suggestions for transactions (both income and expense)
 * strictly taking into account usages in the last 30 days and sorted purely
 * by title/description frequency (NOT grouped or sorted by category).
 */
export function getSmartTransactionSuggestions(
  transactions: Transaction[] = [],
  type: TransactionType = 'expense',
  filterQuery = '',
  limit = 10
): SmartTransactionSuggestion[] {
  const map = loadFrequentMap();
  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;

  // Mine actual transactions in state within the last 30 days
  const txCounts: Record<string, { count: number; totalAmount: number; lastUsed: number; category: string; title: string }> = {};

  transactions
    .filter((t) => t.type === type && t.title?.trim())
    .forEach((t) => {
      const txTime = t.date ? new Date(t.date).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : now);
      if (txTime < cutoff) return; // Disregard transactions older than 30 days

      const key = `${t.type}_${t.title.trim().toLowerCase()}`;
      if (!txCounts[key]) {
        txCounts[key] = {
          count: 1,
          totalAmount: t.amount || 0,
          lastUsed: txTime,
          category: t.category,
          title: t.title.trim(),
        };
      } else {
        txCounts[key].count += 1;
        txCounts[key].totalAmount += t.amount || 0;
        if (txTime > txCounts[key].lastUsed) {
          txCounts[key].lastUsed = txTime;
          txCounts[key].category = t.category || txCounts[key].category;
        }
      }
    });

  // Merge map (from localStorage) + mined transactions
  const merged: Record<string, { title: string; category: string; count: number; totalAmount: number; lastUsed: number }> = {};

  // 1. From stored frequency map (only 30-day usages)
  Object.entries(map).forEach(([key, val]) => {
    if (val.type === type) {
      const validTimestamps = (val.timestamps || []).filter((t) => t >= cutoff);
      let count30d = validTimestamps.length;
      let totalAmt30d = 0;

      if (count30d > 0) {
        val.timestamps?.forEach((t, i) => {
          if (t >= cutoff) {
            totalAmt30d += val.amounts?.[i] || 0;
          }
        });
      } else if (val.lastUsed && val.lastUsed >= cutoff) {
        count30d = Math.max(1, val.count || 1);
        totalAmt30d = val.totalAmount || 0;
      }

      if (count30d > 0) {
        merged[key] = {
          title: val.title,
          category: val.category,
          count: count30d,
          totalAmount: totalAmt30d,
          lastUsed: val.lastUsed || now,
        };
      }
    }
  });

  // 2. From actual transactions array (prevent double counting, take max)
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
        merged[key].category = val.category || merged[key].category;
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

  // Sort STRICTLY by 30-day frequency (count DESC), then recency (lastUsed DESC), then alphabetical by title
  // Completely independent of category!
  results.sort((a, b) => {
    // 1. Primary sort: highest frequency in the last 30 days
    if (b.count !== a.count) return b.count - a.count;
    // 2. Secondary sort: most recently used
    if (b.lastUsed !== a.lastUsed) return b.lastUsed - a.lastUsed;
    // 3. Tertiary sort: alphabetical by title
    return a.title.localeCompare(b.title, 'pl');
  });

  // Filter if query is supplied (purely by title)
  if (filterQuery && filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    results = results.filter((r) => r.title.toLowerCase().includes(q));
  }

  // Fill up with defaults if user has few items
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

  return results.slice(0, limit);
}
