import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  X,
  Search,
  CheckCheck,
  Sparkles,
  Pencil,
  Check,
  Star,
  EyeOff,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { ShoppingList, ShoppingItem, Transaction } from '../types';
import confetti from 'canvas-confetti';
import { getSmartShoppingSuggestions } from '../utils/frequentShoppingItems';
import { SwipeableShoppingItemRow } from './SwipeableShoppingItemRow';
import { ListManagementModal } from './ListManagementModal';

interface ShoppingListsProps {
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  onAddList: (list: Omit<ShoppingList, 'id' | 'createdAt'>) => void;
  onUpdateList?: (id: string, updates: Partial<ShoppingList>) => void;
  onDeleteList: (id: string) => void;
  onAddItem: (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ShoppingItem>) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  initialCategoryFilter?: string | null;
  onClearInitialCategoryFilter?: () => void;
  initialTab?: 'active' | 'completed' | null;
  onClearInitialTab?: () => void;
}

const DEFAULT_CATEGORIES = [
  'Spożywcze',
  'Dom i chemia',
  'Remont i ogród',
  'Dla kotów i zwierząt',
  'Kosmetyki i zdrowie',
  'Inne',
];

const PRESET_PALETTE = [
  '#10b981', // Emerald - Spożywcze
  '#06b6d4', // Cyan - Dom i chemia
  '#f59e0b', // Amber - Remont i ogród
  '#8b5cf6', // Violet - Dla kotów i zwierząt
  '#ec4899', // Pink - Kosmetyki i zdrowie
  '#6366f1', // Indigo - Ślub
  '#3b82f6', // Blue - Auto i transport
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#64748b', // Slate - Inne
];

const CATEGORY_COLORS: Record<string, string> = {
  'Spożywcze': '#10b981',
  'Jedzenie i obiad': '#10b981',
  'Jedzenie i artykuły spożywcze': '#10b981',
  'Dom i chemia': '#06b6d4',
  'Dom': '#06b6d4',
  'Remont i ogród': '#f59e0b',
  'Remont mieszkania': '#f59e0b',
  'Remont i dom': '#f59e0b',
  'Dla kotów i zwierząt': '#8b5cf6',
  'Dla kotów': '#8b5cf6',
  'Kosmetyki i zdrowie': '#ec4899',
  'Zdrowie i kosmetyki': '#ec4899',
  'Ślub': '#6366f1',
  'Auto i transport': '#3b82f6',
  'Inne': '#64748b',
};

export const ShoppingLists: React.FC<ShoppingListsProps> = ({
  shoppingLists,
  shoppingItems,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  initialCategoryFilter,
  onClearInitialCategoryFilter,
  initialTab,
  onClearInitialTab,
}) => {
  // Tab: 'active' (Do kupienia) vs 'completed' (Kupione)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(
    initialCategoryFilter || 'all'
  );

  // Single-session temporary hiding:
  // Items and category pills gray out and move to the end of the list.
  // Resets automatically whenever the user navigates away or refreshes the page!
  const [sessionHiddenCategories, setSessionHiddenCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleSessionHide = (categoryName: string) => {
    setSessionHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  // List Management Modal State (opened via long-press or settings button)
  const [managingList, setManagingList] = useState<ShoppingList | null>(null);

  // Sync category filter & tab if navigated from Dashboard or Notifications
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (onClearInitialTab) {
        onClearInitialTab();
      }
    } else if (initialCategoryFilter && initialCategoryFilter !== 'all') {
      const catItems = shoppingItems.filter(
        (i) =>
          i.category?.toLowerCase() === initialCategoryFilter.toLowerCase() ||
          shoppingLists.find((l) => l.id === i.listId)?.name?.toLowerCase() === initialCategoryFilter.toLowerCase()
      );
      if (catItems.length > 0 && catItems.every((i) => i.isCompleted)) {
        setActiveTab('completed');
      } else if (catItems.some((i) => !i.isCompleted)) {
        setActiveTab('active');
      }
    }

    if (initialCategoryFilter) {
      setSelectedCategoryFilter(initialCategoryFilter);
      if (onClearInitialCategoryFilter) {
        onClearInitialCategoryFilter();
      }
    }
  }, [initialCategoryFilter, initialTab]);

  // Product Input Form State
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Spożywcze');
  const [customCategory, setCustomCategory] = useState('');
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);

  // Dynamic suggestions based on rolling 30-day frequency & current items (max 10)
  const smartSuggestions = useMemo(() => {
    return getSmartShoppingSuggestions(shoppingItems, '').slice(0, 10);
  }, [shoppingItems, isAddFormOpen]);

  // Confirmation before deletion
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);

  // Minimal Edit Item State: ONLY Name and Category as requested
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Spożywcze');

  const handleStartEdit = (item: ShoppingItem, e?: React.MouseEvent | React.SyntheticEvent | { stopPropagation?: () => void }) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category || 'Spożywcze');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    if (onUpdateItem) {
      onUpdateItem(editingItem.id, {
        name: editName.trim(),
        category: editCategory,
      });
    }

    setEditingItem(null);
  };

  // Helper functions for category and list resolution
  const getCategoryList = (catName: string): ShoppingList | undefined => {
    const norm = (catName || '').trim().toLowerCase();
    return shoppingLists.find(
      (l) =>
        (l.name || '').trim().toLowerCase() === norm ||
        (l.category || '').trim().toLowerCase() === norm
    );
  };

  const getCategoryPriority = (catName: string): number => {
    const list = getCategoryList(catName);
    return list?.priority ?? 0;
  };

  const getListColor = (catName: string): string => {
    const list = getCategoryList(catName);
    if (list?.color) return list.color;
    if (CATEGORY_COLORS[catName]) return CATEGORY_COLORS[catName];
    // Deterministic palette fallback
    let hash = 0;
    for (let i = 0; i < catName.length; i++) {
      hash = catName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % PRESET_PALETTE.length;
    return PRESET_PALETTE[idx];
  };

  // Open modal to configure priority / session hide of a category list
  const handleOpenListManagement = (categoryName: string) => {
    const existing = getCategoryList(categoryName);
    if (existing) {
      setManagingList(existing);
    } else {
      const draftList: ShoppingList = {
        id: `list-${Date.now()}`,
        name: categoryName,
        category: categoryName,
        icon: 'ShoppingCart',
        color: getListColor(categoryName),
        priority: 0,
        isHidden: false,
        createdAt: new Date().toISOString(),
      };
      onAddList(draftList);
      setManagingList(draftList);
    }
  };

  // Long press timer for category pills
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const handlePillTouchStartOrMouseDown = (categoryName: string) => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      handleOpenListManagement(categoryName);
    }, 450);
  };

  const handlePillTouchEndOrMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePillClick = (categoryName: string) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    setSelectedCategoryFilter(categoryName);
  };

  // All known categories
  const allKnownCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    shoppingLists.forEach((l) => {
      if (l.name) set.add(l.name);
      if (l.category) set.add(l.category);
    });
    shoppingItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [shoppingLists, shoppingItems]);

  // Aggregate items by category for tab counts
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

  // Categories for Active vs Completed Tab
  const activeCategories = useMemo(() => {
    return categoriesWithItems.filter((c) => c.pendingCount > 0);
  }, [categoriesWithItems]);

  const completedCategories = useMemo(() => {
    return categoriesWithItems.filter((c) => c.allCompleted && c.completedCount > 0);
  }, [categoriesWithItems]);

  // Available filter pills for current tab:
  // Non-hidden categories come first (sorted by list priority DESC then alphabetical).
  // Hidden categories come at the END of the pill bar.
  const currentTabCategories = useMemo(() => {
    const cats = activeTab === 'active' ? activeCategories : completedCategories;
    const normal = cats.filter((c) => !sessionHiddenCategories.has(c.category));
    const hidden = cats.filter((c) => sessionHiddenCategories.has(c.category));

    const sortFn = (
      a: { category: string },
      b: { category: string }
    ) => {
      const pA = getCategoryPriority(a.category);
      const pB = getCategoryPriority(b.category);
      if (pA !== pB) return pB - pA;
      return a.category.localeCompare(b.category, 'pl', { sensitivity: 'base' });
    };

    return [...normal.sort(sortFn), ...hidden.sort(sortFn)];
  }, [activeTab, activeCategories, completedCategories, sessionHiddenCategories, shoppingLists]);

  // Reset category filter if category no longer exists
  useEffect(() => {
    if (selectedCategoryFilter !== 'all') {
      const exists = currentTabCategories.some(
        (c) => c.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
      if (!exists) {
        setSelectedCategoryFilter('all');
      }
    }
  }, [selectedCategoryFilter, currentTabCategories]);

  // Summary counts
  const totalPendingItems = shoppingItems.filter((i) => !i.isCompleted).length;
  const totalCompletedItems = shoppingItems.filter((i) => i.isCompleted).length;

  // Handle adding new item
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const finalCategory = isCreatingCustomCategory
      ? customCategory.trim() || 'Inne'
      : selectedCategory;

    const existingList = getCategoryList(finalCategory);
    const listId = existingList ? existingList.id : `list-${Date.now()}`;

    if (!existingList) {
      onAddList({
        name: finalCategory,
        category: finalCategory,
        icon: 'ShoppingCart',
        color: getListColor(finalCategory),
        description: `Kategoria ${finalCategory}`,
        priority: 0,
        isHidden: false,
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

  // Toggle item with celebration when all items in a category are completed
  const handleToggle = (id: string, category: string) => {
    const item = shoppingItems.find((i) => i.id === id);
    if (!item) return;

    const willBeCompleted = !item.isCompleted;
    onToggleItem(id);

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

  // Flat list of items for current tab:
  // - Filtered by tab (active/completed)
  // - Filtered by search query
  // - In "Wszystkie": unhidden items first (by priority DESC, name ASC),
  //   then hidden items at the VERY END (by priority DESC, name ASC)
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

    const sortFn = (a: ShoppingItem, b: ShoppingItem) => {
      const pA = getCategoryPriority(a.category || 'Spożywcze');
      const pB = getCategoryPriority(b.category || 'Spożywcze');
      if (pA !== pB) return pB - pA;
      return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
    };

    const normalItems = items.filter((i) => !sessionHiddenCategories.has(i.category || 'Spożywcze'));
    const hiddenItems = items.filter((i) => sessionHiddenCategories.has(i.category || 'Spożywcze'));

    return [...normalItems.sort(sortFn), ...hiddenItems.sort(sortFn)];
  }, [shoppingItems, activeTab, searchQuery, sessionHiddenCategories, shoppingLists]);

  // When a specific category is selected
  const singleSelectedCatGroup = useMemo(() => {
    if (selectedCategoryFilter === 'all') return null;
    return currentTabCategories.find((c) => c.category === selectedCategoryFilter) || null;
  }, [selectedCategoryFilter, currentTabCategories]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 w-full">
      {/* Top Header Card with prominent Plus button */}
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
            className={`h-11 w-11 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer ${
              isAddFormOpen
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={isAddFormOpen ? 'Zamknij formularz dodawania' : 'Dodaj produkt do listy'}
            aria-label="Dodaj produkt"
          >
            {isAddFormOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5 stroke-[2.5]" />}
          </button>
        </div>
      </div>

      {/* DESKTOP & MOBILE PRODUCT INPUT FORM: FULLY VISIBLE & ERGONOMIC */}
      {isAddFormOpen && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-indigo-200 shadow-md animate-in fade-in slide-in-from-top-2 duration-150 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Dodaj nowy produkt do listy
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateItem} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              {/* Product Name Input */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  required
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Wpisz nazwę produktu (np. Mleko 3.2%, Masło)..."
                  className="w-full px-4 py-3 text-sm sm:text-base bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 rounded-xl focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-semibold transition-all shadow-2xs"
                />
              </div>

              {/* Category selector / creator */}
              <div className="w-full sm:w-56 shrink-0">
                {!isCreatingCustomCategory ? (
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingCustomCategory(true);
                      } else {
                        setSelectedCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-3 text-sm font-semibold bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-slate-800 focus:outline-hidden cursor-pointer shadow-2xs"
                  >
                    {allKnownCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__">+ Utwórz nową kategorię...</option>
                  </select>
                ) : (
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Nazwa kategorii..."
                      autoFocus
                      className="w-full px-3 py-3 text-sm font-semibold bg-white border-2 border-indigo-400 rounded-xl text-slate-900 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingCustomCategory(false)}
                      className="p-3 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer shrink-0 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>Dodaj</span>
              </button>
            </div>

            {/* Smart 1-Tap Grocery Suggestions based on 30-day frequency (Same stylish layout as QuickAdd) */}
            {smartSuggestions.length > 0 && (
              <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {smartSuggestions.some((s) => s.isFrequent)
                        ? 'Często wybierane w ostatnich 30 dniach'
                        : 'Popularne artykuły domowe'}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">1-klik wstawia</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {smartSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewItemName(sug.name);
                        setSelectedCategory(sug.category);
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer ${
                        sug.isFrequent
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 font-bold'
                          : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-900'
                      }`}
                      title={`${sug.name} • Kategoria: ${sug.category}`}
                    >
                      <span>{sug.emoji}</span>
                      <span className="truncate">{sug.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* STICKY HEADER: PINNED ON TOP IN MOBILE (56px) & DESKTOP (109px), NEVER SCROLLS OUT */}
      <div className="sticky top-[56px] md:top-[109px] z-30 bg-[#F8FAFC]/98 backdrop-blur-md -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 space-y-2.5 border-b border-slate-200/90 shadow-2xs">
        {/* 1. SEARCH BAR AT THE VERY TOP */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj produktów na liście zakupów..."
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-medium shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              title="Wyczyść szukanie"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. MAIN TABS: "Do kupienia" vs "Kupione" */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
              }`}
            >
              <span>Do kupienia</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'active' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {totalPendingItems}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Kupione</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'completed' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {totalCompletedItems}
              </span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline-block font-medium">
            💡 Przytrzymaj zakładkę listy, aby zmienić priorytet lub ukryć
          </span>
        </div>

        {/* 3. CATEGORY FILTER CHIPS WITH LONG-PRESS PRIORITY / HIDING */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Wszystkie
          </button>

          {/* Categories: non-hidden first, then session-hidden at the end */}
          {currentTabCategories.map((catGroup) => {
            const isSelected = selectedCategoryFilter === catGroup.category;
            const color = getListColor(catGroup.category);
            const count =
              activeTab === 'active' ? catGroup.pendingCount : catGroup.completedCount;
            const priority = getCategoryPriority(catGroup.category);
            const isHidden = sessionHiddenCategories.has(catGroup.category);

            return (
              <div key={catGroup.category} className="relative shrink-0 flex items-center">
                <button
                  type="button"
                  onMouseDown={() => handlePillTouchStartOrMouseDown(catGroup.category)}
                  onMouseUp={handlePillTouchEndOrMouseUp}
                  onMouseLeave={handlePillTouchEndOrMouseUp}
                  onTouchStart={() => handlePillTouchStartOrMouseDown(catGroup.category)}
                  onTouchEnd={handlePillTouchEndOrMouseUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleOpenListManagement(catGroup.category);
                  }}
                  onClick={() => handlePillClick(catGroup.category)}
                  title={`${catGroup.category} • Kliknij by filtrować, przytrzymaj by zmienić priorytet/ukryć`}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer border ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs border-slate-900'
                      : isHidden
                      ? 'bg-slate-100/90 text-slate-400 border-dashed border-slate-300 opacity-60 hover:opacity-100'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${isHidden ? 'grayscale' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-[130px]">{catGroup.category}</span>
                  {priority > 0 && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                  {isHidden && (
                    <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-slate-800 text-slate-200'
                        : isHidden
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>

                {/* Quick settings gear for selected category */}
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      handleOpenListManagement(catGroup.category);
                    }}
                    className="ml-1 p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                    title="Ustawienia priorytetu i ukrycia"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BANNER WHEN CURRENTLY VIEWING A SESSION-HIDDEN LIST */}
      {selectedCategoryFilter !== 'all' && sessionHiddenCategories.has(selectedCategoryFilter) && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-slate-700 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Ta lista jest tymczasowo ukryta (jej pozycje są szare na końcu).</span>
          </div>
          <button
            type="button"
            onClick={() => toggleSessionHide(selectedCategoryFilter)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shrink-0 transition-colors cursor-pointer"
          >
            Odkryj listę
          </button>
        </div>
      )}

      {/* SWIPE HINT */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 select-none">
        <span>Przesuń produkt w lewo, aby <b>usunąć</b>, w prawo, aby <b>edytować</b></span>
        {selectedCategoryFilter !== 'all' && (
          <button
            type="button"
            onClick={() => handleOpenListManagement(selectedCategoryFilter)}
            className="text-indigo-600 hover:underline font-semibold cursor-pointer"
          >
            Zarządzaj listą &quot;{selectedCategoryFilter}&quot;
          </button>
        )}
      </div>

      {/* SHOPPING ITEMS LIST */}
      <div className="space-y-2 w-full">
        {selectedCategoryFilter === 'all' ? (
          flatItemsForCurrentTab.length > 0 ? (
            flatItemsForCurrentTab.map((item) => {
              const isHidden = sessionHiddenCategories.has(item.category || 'Spożywcze');
              return (
                <SwipeableShoppingItemRow
                  key={item.id}
                  item={item}
                  listColor={getListColor(item.category || '')}
                  isTempHidden={isHidden}
                  onToggle={handleToggle}
                  onRequestDelete={(it) => setItemToDelete(it)}
                  onEdit={handleStartEdit}
                />
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
              <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {searchQuery
                  ? `Brak wyników dla "${searchQuery}"`
                  : activeTab === 'active'
                  ? 'Brak produktów do kupienia'
                  : 'Brak kupionych produktów'}
              </p>
              <p className="text-xs text-slate-400">
                {activeTab === 'active' && 'Kliknij przycisk "+" powyżej, aby dodać nowy produkt.'}
              </p>
            </div>
          )
        ) : (
          singleSelectedCatGroup && (
            <div className="space-y-2 w-full">
              {singleSelectedCatGroup.items
                .filter((item) => {
                  if (activeTab === 'active' && item.isCompleted) return false;
                  if (activeTab === 'completed' && !item.isCompleted) return false;
                  if (!searchQuery.trim()) return true;
                  return item.name.toLowerCase().includes(searchQuery.toLowerCase());
                })
                .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }))
                .map((item) => {
                  const isHidden = sessionHiddenCategories.has(item.category || 'Spożywcze');
                  return (
                    <SwipeableShoppingItemRow
                      key={item.id}
                      item={item}
                      listColor={getListColor(item.category || '')}
                      isTempHidden={isHidden}
                      onToggle={handleToggle}
                      onRequestDelete={(it) => setItemToDelete(it)}
                      onEdit={handleStartEdit}
                    />
                  );
                })}
            </div>
          )
        )}
      </div>

      {/* LIST MANAGEMENT MODAL (PRIORITY & SESSION HIDING) */}
      {managingList && (
        <ListManagementModal
          list={managingList}
          itemCount={
            shoppingItems.filter(
              (i) =>
                i.listId === managingList.id ||
                i.category?.toLowerCase() === managingList.name.toLowerCase()
            ).length
          }
          isTempHidden={sessionHiddenCategories.has(managingList.name)}
          onToggleSessionHide={toggleSessionHide}
          onClose={() => setManagingList(null)}
          onUpdateList={(id, updates) => {
            if (onUpdateList) {
              onUpdateList(id, updates);
            }
          }}
          onDeleteList={(id) => {
            onDeleteList(id);
            setManagingList(null);
          }}
        />
      )}

      {/* ULTRA-SIMPLIFIED EDIT ITEM MODAL (ONLY NAME AND CATEGORY) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edytuj produkt</h3>
                  <p className="text-[11px] text-slate-500">Zmień nazwę lub kategorię</p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nazwa produktu:
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="np. Mleko 3.2%, Chleb razowy"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategoria / Lista:
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-600 cursor-pointer"
                >
                  {allKnownCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Zapisz</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE DELETING ITEM */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Usunąć produkt?</h3>
                <p className="text-xs text-slate-500">Czy na pewno usunąć ten produkt z listy?</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-xs font-semibold text-slate-500">Produkt:</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                {itemToDelete.name}
              </p>
              <div className="mt-1.5 flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Lista: {itemToDelete.category || 'Spożywcze'}
                </span>
                {itemToDelete.quantity && itemToDelete.quantity > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    Ilość: {itemToDelete.quantity} {itemToDelete.unit || 'szt.'}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Tak, usuń</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
