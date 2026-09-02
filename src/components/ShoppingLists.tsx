import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Search,
  CheckCheck,
} from 'lucide-react';
import { ShoppingList, ShoppingItem, Transaction } from '../types';
import confetti from 'canvas-confetti';

interface ShoppingListsProps {
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  onAddList: (list: Omit<ShoppingList, 'id' | 'createdAt'>) => void;
  onDeleteList: (id: string) => void;
  onAddItem: (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

const DEFAULT_CATEGORIES = [
  'Spożywcze',
  'Dom i chemia',
  'Remont i ogród',
  'Dla kotów i zwierząt',
  'Kosmetyki i zdrowie',
  'Inne',
];

const CATEGORY_COLORS: Record<string, string> = {
  Spożywcze: '#10b981',
  'Jedzenie i obiad': '#10b981',
  'Jedzenie i artykuły spożywcze': '#10b981',
  'Dom i chemia': '#06b6d4',
  Dom: '#06b6d4',
  'Remont i ogród': '#f59e0b',
  'Remont mieszkania': '#f59e0b',
  'Remont i dom': '#f59e0b',
  'Dla kotów i zwierząt': '#8b5cf6',
  'Dla kotów': '#8b5cf6',
  'Kosmetyki i zdrowie': '#ec4899',
  'Zdrowie i kosmetyki': '#ec4899',
  Inne: '#64748b',
};

export const ShoppingLists: React.FC<ShoppingListsProps> = ({
  shoppingLists,
  shoppingItems,
  onAddList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}) => {
  // Tab: 'active' (Do kupienia) vs 'completed' (Kupione)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Streamlined Top Add Form State
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Spożywcze');
  const [customCategory, setCustomCategory] = useState('');
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);

  // All known categories for the dropdown selector when adding a new item
  const allKnownCategories = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_CATEGORIES.forEach((c) => set.add(c));
    shoppingLists.forEach((l) => {
      if (l.name) set.add(l.name);
      if (l.category) set.add(l.category);
    });
    shoppingItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [shoppingLists, shoppingItems]);

  // Group items by category
  const categoriesWithItems = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        items: ShoppingItem[];
        allCompleted: boolean;
        pendingCount: number;
        completedCount: number;
      }
    >();

    shoppingItems.forEach((item) => {
      const cat = item.category || 'Spożywcze';
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          items: [],
          allCompleted: true,
          pendingCount: 0,
          completedCount: 0,
        });
      }
      const entry = map.get(cat)!;
      entry.items.push(item);
      if (item.isCompleted) {
        entry.completedCount += 1;
      } else {
        entry.pendingCount += 1;
        entry.allCompleted = false;
      }
    });

    return Array.from(map.values());
  }, [shoppingItems]);

  // Categories for Active Tab (MUST have at least one uncompleted item)
  const activeCategories = useMemo(() => {
    return categoriesWithItems.filter((c) => c.pendingCount > 0);
  }, [categoriesWithItems]);

  // Categories for Completed Tab (ALL items are completed, and has at least one completed item)
  const completedCategories = useMemo(() => {
    return categoriesWithItems.filter((c) => c.allCompleted && c.completedCount > 0);
  }, [categoriesWithItems]);

  // Available filter pills for the current tab: ONLY categories that actually have items in this tab!
  const currentTabCategories = useMemo(() => {
    return activeTab === 'active' ? activeCategories : completedCategories;
  }, [activeTab, activeCategories, completedCategories]);

  // If the currently selected category filter is not in currentTabCategories, reset to 'all'
  useEffect(() => {
    if (selectedCategoryFilter !== 'all') {
      const exists = currentTabCategories.some((c) => c.category === selectedCategoryFilter);
      if (!exists) {
        setSelectedCategoryFilter('all');
      }
    }
  }, [selectedCategoryFilter, currentTabCategories]);

  // Summary counts
  const totalPendingItems = shoppingItems.filter((i) => !i.isCompleted).length;
  const totalCompletedItems = shoppingItems.filter((i) => i.isCompleted).length;

  // Handle adding new item with minimal inputs
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const finalCategory = isCreatingCustomCategory
      ? customCategory.trim() || 'Inne'
      : selectedCategory;

    const existingList = shoppingLists.find(
      (l) =>
        l.name.toLowerCase() === finalCategory.toLowerCase() ||
        l.category.toLowerCase() === finalCategory.toLowerCase()
    );

    const listId = existingList ? existingList.id : `list-${Date.now()}`;

    if (!existingList) {
      onAddList({
        name: finalCategory,
        category: finalCategory,
        icon: 'ShoppingCart',
        color: CATEGORY_COLORS[finalCategory] || '#4f46e5',
        description: `Kategoria ${finalCategory}`,
      });
    }

    onAddItem({
      listId,
      name: newItemName.trim(),
      isCompleted: false,
      category: finalCategory,
      quantity: 1,
      unit: '',
    });

    setNewItemName('');
    if (isCreatingCustomCategory) {
      setSelectedCategory(finalCategory);
      setIsCreatingCustomCategory(false);
      setCustomCategory('');
    }
  };

  // Toggle item with celebration if all items in category become completed
  const handleToggle = (id: string, category: string) => {
    const item = shoppingItems.find((i) => i.id === id);
    if (!item) return;

    const willBeCompleted = !item.isCompleted;
    onToggleItem(id);

    // If checking off the last item in a category, show confetti
    if (willBeCompleted) {
      const categoryItems = shoppingItems.filter((i) => i.category === category);
      const remainingUncompleted = categoryItems.filter((i) => i.id !== id && !i.isCompleted);
      if (remainingUncompleted.length === 0) {
        try {
          confetti({
            particleCount: 35,
            spread: 50,
            origin: { y: 0.85 },
            colors: ['#10b981', '#6366f1', '#f59e0b'],
          });
        } catch {}
      }
    }
  };

  // Flat list of items for the current tab, sorted alphabetically
  const flatItemsForCurrentTab = useMemo(() => {
    const items = shoppingItems.filter((item) => {
      // In active tab: only uncompleted
      if (activeTab === 'active' && item.isCompleted) return false;
      // In completed tab: only completed
      if (activeTab === 'completed' && !item.isCompleted) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCat = (item.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });

    return items.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
  }, [shoppingItems, activeTab, searchQuery]);

  // When a specific category is selected, get that category group
  const singleSelectedCatGroup = useMemo(() => {
    if (selectedCategoryFilter === 'all') return null;
    return currentTabCategories.find((c) => c.category === selectedCategoryFilter) || null;
  }, [selectedCategoryFilter, currentTabCategories]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex-shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">Lista Zakupów</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Szybkie wpisywanie pozycji i automatyczny podział na kategorie
            </p>
          </div>
        </div>

        {/* Counter Badges */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
            Do kupienia: <strong className="text-slate-900">{totalPendingItems}</strong>
          </span>
          {totalCompletedItems > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hidden sm:inline-block">
              Kupione: <strong className="text-emerald-800">{totalCompletedItems}</strong>
            </span>
          )}
        </div>
      </div>

      {/* STREAMLINED TOP INPUT BAR (Maximal simplicity with just + button) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs">
        <form onSubmit={handleCreateItem} className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
          {/* Product Name Input */}
          <div className="flex-1">
            <input
              type="text"
              required
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Wpisz produkt (np. Mleko, Chleb, Żwirek, Farba)..."
              className="w-full px-3.5 py-3 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Category Selector / Creator */}
          <div className="flex items-center gap-2">
            {!isCreatingCustomCategory ? (
              <div className="flex-1 sm:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsCreatingCustomCategory(true);
                    } else {
                      setSelectedCategory(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-3 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                >
                  {allKnownCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__">+ Nowa kategoria...</option>
                </select>
              </div>
            ) : (
              <div className="flex-1 sm:w-48 flex items-center space-x-1">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Nazwa nowej kategorii..."
                  autoFocus
                  className="w-full px-3 py-3 text-base sm:text-xs bg-slate-50 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCustomCategory(false);
                    setCustomCategory('');
                  }}
                  className="px-2 py-3 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ONLY + BUTTON */}
            <button
              type="submit"
              disabled={!newItemName.trim()}
              className="h-12 w-12 sm:h-11 sm:w-11 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center transition-colors shadow-xs flex-shrink-0"
              title="Dodaj produkt"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>

      {/* Main Tabs: "Do kupienia" vs "Kupione" */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Do kupienia</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'active' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalPendingItems}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'completed'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCheck className="w-4 h-4 text-emerald-500" />
            <span>Kupione</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'completed' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalCompletedItems}
            </span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-36 sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* CATEGORY FILTER CHIPS: Only show categories that have items in the current active/completed view */}
      {currentTabCategories.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Wszystkie kategorie
          </button>
          {currentTabCategories.map((catGroup) => {
            const isSelected = selectedCategoryFilter === catGroup.category;
            const color = CATEGORY_COLORS[catGroup.category] || '#4f46e5';
            const count =
              activeTab === 'active' ? catGroup.pendingCount : catGroup.completedCount;
            return (
              <button
                key={catGroup.category}
                onClick={() => setSelectedCategoryFilter(catGroup.category)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span>{catGroup.category}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* PRODUCTS DISPLAY */}
      <div className="space-y-4">
        {/* Scenario 1: Empty state */}
        {(selectedCategoryFilter === 'all' && flatItemsForCurrentTab.length === 0) ||
        (selectedCategoryFilter !== 'all' && (!singleSelectedCatGroup || singleSelectedCatGroup.items.length === 0)) ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs space-y-2">
            <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm sm:text-base">
              {activeTab === 'active'
                ? 'Brak produktów do kupienia'
                : 'Brak kupionych pozycji'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'active'
                ? 'Wszystko kupione lub lista jest pusta! Wpisz nowy produkt u góry.'
                : 'Gdy kupisz wszystkie produkty z danej kategorii, pojawi się ona w tej zakładce.'}
            </p>
          </div>
        ) : selectedCategoryFilter === 'all' ? (
          /* Scenario 2: "Wszystkie kategorie" -> Display all products alphabetically without category divider cards */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Wszystkie pozycje alfabetycznie ({flatItemsForCurrentTab.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Kliknij produkt, aby {activeTab === 'active' ? 'oznaczyć jako kupiony' : 'przywrócić do listy'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {flatItemsForCurrentTab.map((item) => {
                const itemCat = item.category || 'Spożywcze';
                const catColor = CATEGORY_COLORS[itemCat] || '#4f46e5';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggle(item.id, itemCat)}
                    className={`px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors active:bg-slate-100 ${
                      item.isCompleted ? 'bg-slate-50/50 hover:bg-slate-100/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Checkbox & Product Name */}
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(item.id, itemCat);
                        }}
                        className="p-1 -m-1 text-slate-400 hover:text-emerald-600 transition-colors flex-shrink-0"
                      >
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300" />
                        )}
                      </button>

                      <div className="flex items-center space-x-2.5 min-w-0 truncate">
                        <span
                          className={`text-sm sm:text-base font-medium transition-all truncate ${
                            item.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {item.name}
                        </span>

                        {/* Category Pill Tag */}
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600 flex-shrink-0 border border-slate-200/60">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: catColor }}
                          />
                          <span>{itemCat}</span>
                        </span>
                      </div>
                    </div>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="p-2 text-slate-300 hover:text-rose-600 transition-colors rounded-lg flex-shrink-0"
                      title="Usuń pozycję"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Scenario 3: Specific category selected -> Display that category's card */
          singleSelectedCatGroup && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all">
              {/* Category Card Header */}
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[singleSelectedCatGroup.category] || '#4f46e5' }}
                  />
                  <h2 className="font-bold text-sm sm:text-base text-slate-900">
                    {singleSelectedCatGroup.category}
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                    {activeTab === 'active'
                      ? `${singleSelectedCatGroup.pendingCount} do kupienia`
                      : `${singleSelectedCatGroup.completedCount} kupione`}
                  </span>
                </div>

                {activeTab === 'completed' && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">100% Kupione</span>
                  </span>
                )}
              </div>

              {/* Items in this category */}
              <div className="divide-y divide-slate-100">
                {singleSelectedCatGroup.items
                  .filter((item) => {
                    if (activeTab === 'active' && item.isCompleted) return false;
                    if (activeTab === 'completed' && !item.isCompleted) return false;
                    if (!searchQuery.trim()) return true;
                    return item.name.toLowerCase().includes(searchQuery.toLowerCase());
                  })
                  .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }))
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggle(item.id, singleSelectedCatGroup.category)}
                      className={`px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors active:bg-slate-100 ${
                        item.isCompleted ? 'bg-slate-50/50 hover:bg-slate-100/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox & Product Name */}
                      <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(item.id, singleSelectedCatGroup.category);
                          }}
                          className="p-1 -m-1 text-slate-400 hover:text-emerald-600 transition-colors flex-shrink-0"
                        >
                          {item.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </button>

                        <span
                          className={`text-sm sm:text-base font-medium transition-all truncate ${
                            item.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* Delete Action */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(item.id);
                        }}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors rounded-lg flex-shrink-0"
                        title="Usuń pozycję"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
