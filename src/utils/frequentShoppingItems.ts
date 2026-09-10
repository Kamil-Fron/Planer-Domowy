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

/**
 * Load persistent frequency record from localStorage
 */
export function loadFrequentHistory(): Record<string, { name: string; category: string; count: number; lastUsed: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Record usage when a shopping item is added or edited
 */
export function recordShoppingItemUsage(name: string, category: string, _unit?: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const key = trimmed.toLowerCase();
  try {
    const history = loadFrequentHistory();
    const existing = history[key];

    history[key] = {
      name: trimmed, // keep actual casing
      category: category.trim() || existing?.category || 'Spożywcze',
      count: (existing?.count || 0) + 1,
      lastUsed: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Generates smart suggestions by combining:
 * 1. Historical frequency of user-added items (saved in localStorage)
 * 2. Current shopping items (both active and completed in the database/state)
 * 3. Fallback defaults if the user has few records
 *
 * Returned list is sorted so that user's most frequently chosen items appear first!
 */
export function getSmartShoppingSuggestions(
  currentItems: ShoppingItem[] = [],
  filterQuery: string = ''
): SmartSuggestionItem[] {
  const history = loadFrequentHistory();

  // Combine history with all current items in memory
  const aggregated = new Map<string, { name: string; category: string; count: number; lastUsed: number; isFrequent: boolean }>();

  // 1. Ingest history
  Object.entries(history).forEach(([key, item]) => {
    aggregated.set(key, {
      name: item.name,
      category: item.category,
      count: item.count,
      lastUsed: item.lastUsed,
      isFrequent: true,
    });
  });

  // 2. Ingest current items (ensure any existing items are counted)
  currentItems.forEach((item) => {
    if (!item.name?.trim()) return;
    const key = item.name.trim().toLowerCase();
    const existing = aggregated.get(key);
    if (existing) {
      existing.count += 1;
      existing.category = item.category || existing.category;
      existing.isFrequent = true;
    } else {
      aggregated.set(key, {
        name: item.name.trim(),
        category: item.category || 'Spożywcze',
        count: 1,
        lastUsed: new Date(item.createdAt || Date.now()).getTime(),
        isFrequent: true,
      });
    }
  });

  // Convert to array and sort by frequency (count DESC), then lastUsed (DESC)
  const userSuggestions: SmartSuggestionItem[] = Array.from(aggregated.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastUsed - a.lastUsed;
    })
    .map((item) => ({
      ...item,
      emoji: guessEmojiForProduct(item.name, item.category),
    }));

  // If user has search query, filter suggestions
  if (filterQuery.trim()) {
    const q = filterQuery.trim().toLowerCase();
    return userSuggestions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }

  // Build top list: user's frequent items first, up to 10
  const result: SmartSuggestionItem[] = [...userSuggestions.slice(0, 10)];

  // If fewer than 8 suggestions, fill with default domestic suggestions that aren't already included
  if (result.length < 8) {
    const existingKeys = new Set(result.map((r) => r.name.toLowerCase()));
    for (const def of DEFAULT_SHOPPING_SUGGESTIONS) {
      if (result.length >= 8) break;
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

  return result;
}
