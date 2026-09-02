import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Search,
  CheckCheck,
  X,
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

  // Hidden under plus button state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
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
      if (activeTab === 'active' && item.isCompleted) return false;
      if (activeTab === 'completed' && !item.isCompleted) return false;

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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4 w-full overflow-hidden">
      {/* Top Header with prominent Plus button */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Lista Zakupów</h1>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {totalPendingItems > 0 ? `${totalPendingItems} do kupienia` : 'Wszystko kupione!'}
            </p>
          </div>
        </div>

        {/* Plus button to open product entry */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsAddFormOpen((prev) => !prev)}
            className={`h-11 w-11 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all shadow-xs ${
              isAddFormOpen
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={isAddFormOpen ? 'Zamknij' : 'Dodaj produkt do listy'}
            aria-label="Dodaj produkt"
          >
            {isAddFormOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5 stroke-[2.5]" />}
          </button>
        </div>
      </div>

      {/* EXPANDABLE INPUT FORM: ONLY REVEALED ON CLICKING THE PLUS BUTTON */}
      {isAddFormOpen && (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-indigo-200 shadow-md animate-in fade-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleCreateItem} className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
            {/* Product Name Input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                required
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Wpisz produkt (np. Mleko, Chleb, Karma)..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Category Selector / Creator */}
            <div className="flex items-center gap-2 shrink-0">
              {!isCreatingCustomCategory ? (
                <div className="w-40 sm:w-44">
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingCustomCategory(true);
                      } else {
                        setSelectedCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                  >
                    {allKnownCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__">+ Nowa...</option>
                  </select>
                </div>
              ) : (
                <div className="w-40 sm:w-44 flex items-center space-x-1">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Nowa kategoria..."
                    autoFocus
                    className="w-full px-2.5 py-2.5 text-xs bg-slate-50 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCustomCategory(false);
                      setCustomCategory('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Submit + Button */}
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center transition-colors shadow-xs shrink-0"
                title="Dodaj"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Tabs: "Do kupienia" vs "Kupione" & Search */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-2">
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Do kupienia</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'active' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalPendingItems}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'completed'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Kupione</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'completed' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalCompletedItems}
            </span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-32 sm:w-48 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj..."
            className="w-full pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* CATEGORY FILTER CHIPS: Compact overflow-protected row */}
      {currentTabCategories.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Wszystkie
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
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate max-w-[120px]">{catGroup.category}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* PRODUCTS DISPLAY - Max focus on items */}
      <div className="space-y-3 w-full">
        {(selectedCategoryFilter === 'all' && flatItemsForCurrentTab.length === 0) ||
        (selectedCategoryFilter !== 'all' && (!singleSelectedCatGroup || singleSelectedCatGroup.items.length === 0)) ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs space-y-2">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">
              {activeTab === 'active' ? 'Brak pozycji do kupienia' : 'Brak kupionych pozycji'}
            </p>
            <p className="text-xs text-slate-400">
              {activeTab === 'active' ? 'Kliknij "+" u góry, aby dopisać nowy produkt.' : ''}
            </p>
          </div>
        ) : selectedCategoryFilter === 'all' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100 w-full">
            {flatItemsForCurrentTab.map((item) => {
              const itemCat = item.category || 'Spożywcze';
              const catColor = CATEGORY_COLORS[itemCat] || '#4f46e5';

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggle(item.id, itemCat)}
                  className={`px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors active:bg-slate-100 max-w-full overflow-hidden ${
                    item.isCompleted ? 'bg-slate-50/50 hover:bg-slate-100/60' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Checkbox & Product Name */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(item.id, itemCat);
                      }}
                      className="p-1 -m-1 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                    >
                      {item.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div className="flex items-center space-x-2 min-w-0 flex-1 truncate">
                      <span
                        className={`text-xs sm:text-sm font-medium transition-all truncate ${
                          item.isCompleted
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 font-semibold'
                        }`}
                      >
                        {item.name}
                      </span>

                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-600 shrink-0 border border-slate-200/60 max-w-[100px] truncate">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                        <span className="truncate">{itemCat}</span>
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
                    className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors rounded-lg shrink-0"
                    title="Usuń"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          singleSelectedCatGroup && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full divide-y divide-slate-100">
              <div className="px-3.5 py-2.5 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[singleSelectedCatGroup.category] || '#4f46e5' }}
                  />
                  <h2 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {singleSelectedCatGroup.category}
                  </h2>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 shrink-0">
                  {activeTab === 'active'
                    ? singleSelectedCatGroup.pendingCount
                    : singleSelectedCatGroup.completedCount}
                </span>
              </div>

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
                      className={`px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors active:bg-slate-100 max-w-full overflow-hidden ${
                        item.isCompleted ? 'bg-slate-50/50 hover:bg-slate-100/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(item.id, singleSelectedCatGroup.category);
                          }}
                          className="p-1 -m-1 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                        >
                          {item.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </button>

                        <span
                          className={`text-xs sm:text-sm font-medium transition-all truncate ${
                            item.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(item.id);
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors rounded-lg shrink-0"
                        title="Usuń"
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

