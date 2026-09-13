import { ShoppingItem } from '../types';

export interface SmartSuggestionItem {
  name: string;
  category: string;
  emoji: string;
  count: number;
  lastUsed: number;
  isFrequent: boolean;
}

const STORAGE_KEY = 'house_budget_frequent_shopping_items';

// Default domestic essentials to provide a solid baseline if user hasn't added many items yet
export const DEFAULT_SHOPPING_SUGGESTIONS: Array<{ name: string; category: string; emoji: string }> = [
  { name: 'Chleb żytni', category: 'Spożywcze', emoji: '🥖' },
  { name: 'Mleko 3.2%', category: 'Spożywcze', emoji: '🥛' },
  { name: 'Masło ekstra', category: 'Spożywcze', emoji: '🧈' },
  { name: 'Jajka wolny wybieg', category: 'Spożywcze', emoji: '🥚' },
  { name: 'Kawa ziarnista', category: 'Spożywcze', emoji: '☕' },
  { name: 'Pomidory', category: 'Spożywcze', emoji: '🍅' },
  { name: 'Banany', category: 'Spożywcze', emoji: '🍌' },
  { name: 'Karma dla zwierząt', category: 'Dla kotów i zwierząt', emoji: '🐾' },
  { name: 'Papier toaletowy', category: 'Dom i chemia', emoji: '🧻' },
  { name: 'Płyn do naczyń / prania', category: 'Dom i chemia', emoji: '🧴' },
];

/**
 * Smart emoji resolver based on product keywords and Polish grammar variations
 */
export function guessEmojiForProduct(name: string, category?: string): string {
  const lower = name.toLowerCase();

  // Sweets & snacks
  if (
    lower.includes('żelk') ||
    lower.includes('zelk') ||
    lower.includes('cukierk') ||
    lower.includes('słodycz') ||
    lower.includes('czekolad') ||
    lower.includes('baton') ||
    lower.includes('wafel') ||
    lower.includes('lizak') ||
    lower.includes('ciastk')
  ) {
    return '🍬';
  }

  // Bakery
  if (
    lower.includes('chleb') ||
    lower.includes('bułk') ||
    lower.includes('pieczyw') ||
    lower.includes('bagietk') ||
    lower.includes('rogal') ||
    lower.includes('toast')
  ) {
    return '🥖';
  }

  // Dairy
  if (
    lower.includes('mlek') ||
    lower.includes('śmietan') ||
    lower.includes('smietan') ||
    lower.includes('kefir') ||
    lower.includes('jogurt') ||
    lower.includes('maślank')
  ) {
    return '🥛';
  }

  // Butter & fats
  if (lower.includes('masł') || lower.includes('maslo') || lower.includes('margaryn') || lower.includes('olej') || lower.includes('oliw')) {
    return '🧈';
  }

  // Eggs
  if (lower.includes('jaj') || lower.includes('jajk')) {
    return '🥚';
  }

  // Coffee & tea
  if (lower.includes('kaw') || lower.includes('herbat') || lower.includes('espresso')) {
    return '☕';
  }

  // Vegetables
  if (
    lower.includes('pomidor') ||
    lower.includes('ogór') ||
    lower.includes('ogor') ||
    lower.includes('warzyw') ||
    lower.includes('sałat') ||
    lower.includes('salat') ||
    lower.includes('marchew') ||
    lower.includes('ziemniak') ||
    lower.includes('cebul') ||
    lower.includes('czosnek') ||
    lower.includes('papryk')
  ) {
    return '🍅';
  }

  // Fruits
  if (
    lower.includes('banan') ||
    lower.includes('jabłk') ||
    lower.includes('jablk') ||
    lower.includes('owoc') ||
    lower.includes('cytryn') ||
    lower.includes('pomarańcz') ||
    lower.includes('winogron') ||
    lower.includes('truskawk') ||
    lower.includes('borówk')
  ) {
    return '🍌';
  }

  // Meat & poultry
  if (
    lower.includes('mięs') ||
    lower.includes('mies') ||
    lower.includes('wędlin') ||
    lower.includes('wedlin') ||
    lower.includes('szynk') ||
    lower.includes('kurczak') ||
    lower.includes('parówk') ||
    lower.includes('kiełbas') ||
    lower.includes('kielbas') ||
    lower.includes('schab') ||
    lower.includes('wołow')
  ) {
    return '🥩';
  }

  // Fish
  if (lower.includes('ryb') || lower.includes('łosoś') || lower.includes('losos') || lower.includes('tuńczyk') || lower.includes('dorsz')) {
    return '🐟';
  }

  // Cheese
  if (lower.includes('ser') || lower.includes('twaróg') || lower.includes('mozzarella') || lower.includes('parmezan')) {
    return '🧀';
  }

  // Drinks
  if (
    lower.includes('wod') ||
    lower.includes('napój') ||
    lower.includes('napoj') ||
    lower.includes('sok') ||
    lower.includes('cola') ||
    lower.includes('pepsi')
  ) {
    return '🧃';
  }

  // Alcohol
  if (lower.includes('piw') || lower.includes('win') || lower.includes('prosecco') || lower.includes('alkohol')) {
    return '🍷';
  }

  // Hygiene & paper
  if (lower.includes('papier') || lower.includes('ręcznik') || lower.includes('recznik') || lower.includes('chusteczk')) {
    return '🧻';
  }

  // Cleaning & detergents
  if (
    lower.includes('prosz') ||
    lower.includes('płyn') ||
    lower.includes('plyn') ||
    lower.includes('kapsułk') ||
    lower.includes('kapsulk') ||
    lower.includes('mydł') ||
    lower.includes('szampon') ||
    lower.includes('past') ||
    lower.includes('gąbk')
  ) {
    return '🧴';
  }

  // Pets
  if (
    lower.includes('kot') ||
    lower.includes('pies') ||
    lower.includes('psa') ||
    lower.includes('zwierz') ||
    lower.includes('karm') ||
    lower.includes('żwirek') ||
    lower.includes('zwirek') ||
    lower.includes('przysmak')
  ) {
    return '🐾';
  }

  // Hardware & home renovation
  if (
    lower.includes('farb') ||
    lower.includes('klej') ||
    lower.includes('śrub') ||
    lower.includes('srub') ||
    lower.includes('listw') ||
    lower.includes('lamp') ||
    lower.includes('korytk') ||
    lower.includes('próg') ||
    lower.includes('prog') ||
    lower.includes('remont') ||
    lower.includes('kołk') ||
    lower.includes('wkręt') ||
    lower.includes('kabel') ||
    lower.includes('gniazdk') ||
    lower.includes('żarówk') ||
    lower.includes('zarowk')
  ) {
    return '🔨';
  }

  // Pharmacy & health
  if (
    lower.includes('lekarstw') ||
    lower.includes('tablet') ||
    lower.includes('witamin') ||
    lower.includes('apte') ||
    lower.includes('ibuprom') ||
    lower.includes('paracetamol')
  ) {
    return '💊';
  }

  // Category based fallbacks
  const cat = (category || '').toLowerCase();
  if (cat.includes('zwierz')) return '🐾';
  if (cat.includes('remont') || cat.includes('dom') || cat.includes('ogród')) return '🛠️';
  if (cat.includes('zdrow') || cat.includes('kosmetyk') || cat.includes('apte')) return '💊';
  if (cat.includes('chemia') || cat.includes('czystość')) return '🧴';

  return '🛒';
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FrequentShoppingHistoryEntry {
  name: string;
  category: string;
  timestamps?: number[];
  count?: number;
  lastUsed: number;
}

/**
 * Load persistent frequency record from localStorage
 */
export function loadFrequentHistory(): Record<string, FrequentShoppingHistoryEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Record usage when a shopping item is added or edited.
 * Maintains rolling 30-day history per description (name).
 */
export function recordShoppingItemUsage(name: string, category: string, _unit?: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const key = trimmed.toLowerCase();
  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;

  try {
    const history = loadFrequentHistory();
    const existing = history[key];

    // Clean existing timestamps older than 30 days
    const validTimestamps = (existing?.timestamps || []).filter(
      (t) => typeof t === 'number' && t >= cutoff
    );

    // If migrating legacy entry without timestamps array:
    if (validTimestamps.length === 0 && existing?.lastUsed && existing.lastUsed >= cutoff) {
      validTimestamps.push(existing.lastUsed);
    }

    // Add current usage
    validTimestamps.push(now);

    history[key] = {
      name: trimmed, // keep latest casing
      category: category.trim() || existing?.category || 'Spożywcze',
      timestamps: validTimestamps,
      count: validTimestamps.length,
      lastUsed: now,
    };

    // Clean up completely expired items from storage
    Object.keys(history).forEach((k) => {
      const entry = history[k];
      if (entry.timestamps) {
        entry.timestamps = entry.timestamps.filter((t) => t >= cutoff);
        entry.count = entry.timestamps.length;
        if (entry.timestamps.length === 0 && (!entry.lastUsed || entry.lastUsed < cutoff)) {
          delete history[k];
        }
      } else if (entry.lastUsed && entry.lastUsed < cutoff) {
        delete history[k];
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Decrement usage counter when a shopping item is deleted.
 * Prevents cancelled or accidentally added items from artificially ranking high.
 */
export function unrecordShoppingItemUsage(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;

  const key = trimmed.toLowerCase();
  try {
    const history = loadFrequentHistory();
    const existing = history[key];
    if (!existing) return;

    if (existing.timestamps && existing.timestamps.length > 0) {
      existing.timestamps.pop();
      existing.count = existing.timestamps.length;
      if (existing.timestamps.length === 0) {
        delete history[key];
      } else {
        existing.lastUsed = existing.timestamps[existing.timestamps.length - 1];
      }
    } else if (existing.count && existing.count > 1) {
      existing.count -= 1;
    } else {
      delete history[key];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Generates smart suggestions by combining:
 * 1. Rolling 30-day frequency of user-added items (from localStorage)
 * 2. Recent shopping items in state from the last 30 days
 * 3. Fallback defaults if the user has few records
 *
 * Returned list is sorted strictly by usage count in the last 30 days (purely by description, NOT category).
 */
export function getSmartShoppingSuggestions(
  currentItems: ShoppingItem[] = [],
  filterQuery: string = ''
): SmartSuggestionItem[] {
  const history = loadFrequentHistory();
  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;

  // Map of normalized description -> aggregated data
  const aggregated = new Map<
    string,
    { name: string; category: string; count: number; lastUsed: number; isFrequent: boolean }
  >();

  // 1. Ingest history from localStorage (only usages in the last 30 days)
  Object.entries(history).forEach(([key, item]) => {
    const validTimestamps = (item.timestamps || []).filter((t) => t >= cutoff);
    let countIn30d = validTimestamps.length;

    // Legacy fallback: if timestamps wasn't present but lastUsed is within 30 days
    if (countIn30d === 0 && item.lastUsed && item.lastUsed >= cutoff) {
      countIn30d = Math.max(1, item.count || 1);
    }

    if (countIn30d > 0) {
      aggregated.set(key, {
        name: item.name,
        category: item.category,
        count: countIn30d,
        lastUsed: item.lastUsed || now,
        isFrequent: countIn30d >= 2,
      });
    }
  });

  // 2. Ingest current shopping items that were created in the last 30 days
  const currentItemsCountMap = new Map<string, { count: number; lastUsed: number; name: string; category: string }>();
  currentItems.forEach((item) => {
    if (!item.name?.trim()) return;
    const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : now;
    if (itemTime < cutoff) return; // Ignore items older than 30 days

    const key = item.name.trim().toLowerCase();
    const existing = currentItemsCountMap.get(key);
    if (existing) {
      existing.count += 1;
      if (itemTime > existing.lastUsed) {
        existing.lastUsed = itemTime;
        existing.category = item.category || existing.category;
      }
    } else {
      currentItemsCountMap.set(key, {
        name: item.name.trim(),
        category: item.category || 'Spożywcze',
        count: 1,
        lastUsed: itemTime,
      });
    }
  });

  // Merge currentItemsCountMap: take the maximum count to prevent double counting
  currentItemsCountMap.forEach((ci, key) => {
    const existing = aggregated.get(key);
    if (existing) {
      existing.count = Math.max(existing.count, ci.count);
      if (ci.lastUsed > existing.lastUsed) {
        existing.lastUsed = ci.lastUsed;
        existing.category = ci.category || existing.category;
      }
      existing.isFrequent = existing.count >= 2;
    } else {
      aggregated.set(key, {
        name: ci.name,
        category: ci.category,
        count: ci.count,
        lastUsed: ci.lastUsed,
        isFrequent: ci.count >= 2,
      });
    }
  });

  // Convert to array and sort STRICTLY by description frequency in last 30 days (count DESC), then lastUsed (DESC)
  // Completely independent of category!
  const userSuggestions: SmartSuggestionItem[] = Array.from(aggregated.values())
    .sort((a, b) => {
      // 1. Primary sort: highest frequency in the last 30 days
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // 2. Secondary sort: most recently used
      if (b.lastUsed !== a.lastUsed) {
        return b.lastUsed - a.lastUsed;
      }
      // 3. Tertiary sort: alphabetical by name
      return a.name.localeCompare(b.name, 'pl');
    })
    .map((item) => ({
      ...item,
      emoji: guessEmojiForProduct(item.name, item.category),
    }));

  // If user has search query, filter suggestions purely by product description
  if (filterQuery.trim()) {
    const q = filterQuery.trim().toLowerCase();
    return userSuggestions.filter((s) => s.name.toLowerCase().includes(q));
  }

  // Build top list: user's frequent items first, max 10
  const result: SmartSuggestionItem[] = [...userSuggestions.slice(0, 10)];

  // If fewer than 10 suggestions, fill with default domestic suggestions that aren't already included (up to 10)
  if (result.length < 10) {
    const existingKeys = new Set(result.map((r) => r.name.toLowerCase()));
    for (const def of DEFAULT_SHOPPING_SUGGESTIONS) {
      if (result.length >= 10) break;
      if (!existingKeys.has(def.name.toLowerCase())) {
        result.push({
          name: def.name,
          category: def.category,
          emoji: def.emoji,
          count: 0,
          lastUsed: 0,
          isFrequent: false,
        });
        existingKeys.add(def.name.toLowerCase());
      }
    }
  }

  return result.slice(0, 10);
}
