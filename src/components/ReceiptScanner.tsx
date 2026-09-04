import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Camera,
  Sparkles,
  Receipt,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  ShoppingCart,
  Store,
  Calendar,
  DollarSign,
  Tag,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Key,
  ShieldCheck,
  FileText,
  Layers,
  ListPlus,
  CheckCircle2,
  Clipboard,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { ReceiptItemDetail, ReceiptScanResult, Transaction, ShoppingItem, TransactionType } from '../types';

export type ReceiptSaveMode = 'consolidated' | 'by_category' | 'individual';
import { INITIAL_CATEGORIES, INITIAL_INCOME_CATEGORIES, SAMPLE_RECEIPTS } from '../mockData';
import {
  checkAiAvailability,
  scanReceiptWithAI,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  AiStatusResult,
} from '../services/aiService';

interface ReceiptScannerProps {
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onReceiptScanned?: (extracted: {
    title: string;
    amount: number;
    category: any;
    date: string;
    items?: { name: string; price: number; quantity: number }[];
  }) => void;
  shoppingItems?: ShoppingItem[];
  onCompleteShoppingItem?: (itemId: string) => void;
  onNavigateToTransactions?: () => void;
  onCancel?: () => void;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onAddTransaction,
  onReceiptScanned,
  shoppingItems = [],
  onCompleteShoppingItem,
  onNavigateToTransactions,
  onCancel,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [saveMode, setSaveMode] = useState<ReceiptSaveMode>('consolidated');
  
  const [aiStatus, setAiStatus] = useState<AiStatusResult>({
    isConfigured: false,
    source: 'none',
    message: 'Sprawdzanie połączenia z AI...',
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [inputApiKey, setInputApiKey] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check AI availability on mount & when key changes
  const refreshAiStatus = async () => {
    const status = await checkAiAvailability();
    setAiStatus(status);
    setInputApiKey(getStoredGeminiApiKey());
  };

  useEffect(() => {
    refreshAiStatus();
  }, []);

  const handleSaveKey = () => {
    saveStoredGeminiApiKey(inputApiKey);
    setIsKeyModalOpen(false);
    refreshAiStatus();
  };

  // Helper to load file (from input, drop, or clipboard)
  const processFile = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
    setSuccessMessage(null);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Handle clipboard paste (both via shortcut and dropzone event)
  const handlePasteEvent = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
    // Don't intercept if user is typing text into an input or textarea
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    const clipboardData = (e as ClipboardEvent).clipboardData || (e as React.ClipboardEvent).clipboardData;
    if (!clipboardData) return;

    // First check items for image / pdf
    const items = clipboardData.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            setPasteNotice('Wklejono obraz ze schowka!');
            setTimeout(() => setPasteNotice(null), 4000);
            return;
          }
        } else if (item.type === 'application/pdf') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            setPasteNotice('Wklejono plik PDF ze schowka!');
            setTimeout(() => setPasteNotice(null), 4000);
            return;
          }
        }
      }
    }

    // Check files
    if (clipboardData.files && clipboardData.files.length > 0) {
      const file = clipboardData.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (!isInputFocused) {
          e.preventDefault();
          processFile(file);
          setPasteNotice('Wklejono dokument ze schowka!');
          setTimeout(() => setPasteNotice(null), 4000);
        }
      }
    }
  }, [processFile]);

  // Global window paste listener when user is in the scan screen
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // Allow pasting in the initial document selection phase
      if (!scanResult) {
        handlePasteEvent(e);
      }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => {
      window.removeEventListener('paste', onWindowPaste);
    };
  }, [handlePasteEvent, scanResult]);

  // Direct Clipboard button click handler (Clipboard API)
  const handlePasteFromClipboardClick = async () => {
    try {
      if (!navigator.clipboard) {
        setError('Twoja przeglądarka nie pozwala na bezpośredni odczyt schowka. Użyj skrótu klawiszowego Ctrl+V (lub Cmd+V).');
        return;
      }

      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const targetType = item.types.find((t) => t.startsWith('image/') || t === 'application/pdf');
          if (targetType) {
            const blob = await item.getType(targetType);
            const ext = targetType.startsWith('image/') ? targetType.split('/')[1] || 'png' : 'pdf';
            const file = new File([blob], `schowek_${Date.now()}.${ext}`, { type: targetType });
            processFile(file);
            setPasteNotice('Pomyślnie wklejono dokument ze schowka!');
            setTimeout(() => setPasteNotice(null), 4000);
            return;
          }
        }
        setError('W schowku nie znaleziono obrazu ani pliku PDF. Skopiuj zrzut ekranu lub plik (Ctrl+C) i spróbuj ponownie.');
      } else {
        setError('Kliknij na to okno i wciśnij Ctrl+V (lub Cmd+V na Macu), aby wkleić obraz ze schowka.');
      }
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      setError('Aby wkleić obraz ze schowka, naciśnij skrót Ctrl+V (lub Cmd+V na Macu) na klawiaturze.');
    }
  };

  // Perform AI scan using Gemini API (Hybrid server + client for GitHub Pages)
  const handleScanReceipt = async (base64Img?: string, mimeType?: string) => {
    const dataToSend = base64Img || imagePreview;
    if (!dataToSend) {
      setError('Wybierz plik ze zdjęciem paragonu lub skorzystaj z przykładu.');
      return;
    }

    const isPdf =
      selectedFile?.type === 'application/pdf' ||
      Boolean(selectedFile?.name?.toLowerCase().endsWith('.pdf')) ||
      Boolean(dataToSend && dataToSend.startsWith('data:application/pdf'));

    const effectiveMime = isPdf
      ? 'application/pdf'
      : (mimeType || selectedFile?.type || 'image/jpeg');

    setIsScanning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await scanReceiptWithAI(dataToSend, effectiveMime);

      if (data) {
        const defaultDocDate = data.date || new Date().toISOString().split('T')[0];
        // Initialize selection status, item types (income vs expense), and retain individual item dates (especially for multi-date PDF statements)
        const itemsWithSelection: ReceiptItemDetail[] = (data.items || []).map((item: any) => {
          const isItemIncome =
            item.type === 'income' ||
            (INITIAL_INCOME_CATEGORIES as readonly string[]).includes(item.category) ||
            /wpłata|uznanie|wynagrodzenie|pensja|premia|zwrot|pożyczka|kredyt|świadczenie|800\+|darowizna|sprzedaż/i.test(item.name || '');

          const itemType: TransactionType = isItemIncome ? 'income' : 'expense';
          const defaultCat = itemType === 'income' ? 'Inne wpływy' : (data.dominantCategory || 'Jedzenie i artykuły spożywcze');
          const category = item.category || defaultCat;

          return {
            name: item.name,
            type: itemType,
            price: Math.abs(Number(item.price)) || 0,
            quantity: Number(item.quantity) || 1,
            category,
            date: item.date || defaultDocDate,
            notes: item.notes || '',
            selected: true,
          };
        });

        setScanResult({
          storeName: data.storeName || 'Sklep / Dokument',
          date: defaultDocDate,
          totalAmount: Number(data.totalAmount) || itemsWithSelection.reduce((s, i) => s + i.price, 0),
          currency: data.currency || 'PLN',
          receiptNumber: data.receiptNumber || '',
          dominantCategory: data.dominantCategory || 'Jedzenie i artykuły spożywcze',
          summary: data.summary || 'Pomyślnie przeanalizowano pozycje z dokumentu.',
          items: itemsWithSelection,
        });
      } else {
        throw new Error('Model AI nie zwrócił danych paragonu.');
      }
    } catch (err: any) {
      console.error('Błąd podczas skanowania paragonu AI:', err);
      setError(
        err?.message ||
          'Wystąpił problem z przetworzeniem zdjęcia przez model Gemini AI. Upewnij się, że zdjęcie jest wyraźne i dobrze oświetlone lub podaj poprawny klucz GEMINI_API_KEY.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Quick load sample receipt
  const handleLoadSample = (sample: typeof SAMPLE_RECEIPTS[0]) => {
    setSelectedFile(null);
    setImagePreview(null);
    setError(null);
    setSuccessMessage(null);
    const docDate = sample.date || new Date().toISOString().split('T')[0];
    setScanResult({
      storeName: sample.storeName,
      date: docDate,
      totalAmount: sample.totalAmount,
      currency: sample.currency,
      dominantCategory: sample.dominantCategory,
      summary: sample.summary,
      items: sample.items.map((i) => {
        const itemType: TransactionType =
          (i as any).type ||
          ((INITIAL_INCOME_CATEGORIES as readonly string[]).includes(i.category) ? 'income' : 'expense');
        return {
          ...i,
          type: itemType,
          date: (i as any).date || docDate,
          selected: true,
        };
      }),
    });
  };

  // Toggle item selection
  const handleToggleItem = (index: number) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    updatedItems[index].selected = !updatedItems[index].selected;
    setScanResult({ ...scanResult, items: updatedItems });
  };

  // Toggle transaction type (expense vs income) for an individual item
  const handleToggleItemType = (index: number) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    const currentType = updatedItems[index].type === 'income' ? 'income' : 'expense';
    const newType: TransactionType = currentType === 'income' ? 'expense' : 'income';
    updatedItems[index].type = newType;

    // Adapt category if needed
    if (newType === 'income') {
      const isAlreadyIncomeCat = (INITIAL_INCOME_CATEGORIES as readonly string[]).includes(updatedItems[index].category);
      if (!isAlreadyIncomeCat) {
        updatedItems[index].category = INITIAL_INCOME_CATEGORIES[0];
      }
    } else {
      const isAlreadyExpenseCat = INITIAL_CATEGORIES.some((c) => c.name === updatedItems[index].category);
      if (!isAlreadyExpenseCat) {
        updatedItems[index].category = INITIAL_CATEGORIES[0].name;
      }
    }
    setScanResult({ ...scanResult, items: updatedItems });
  };

  // Update category of an individual item
  const handleItemCategoryChange = (index: number, newCat: string) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    updatedItems[index].category = newCat;
    setScanResult({ ...scanResult, items: updatedItems });
  };

  // Update individual date of an item (e.g. For bank statement lines)
  const handleItemDateChange = (index: number, newDate: string) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    updatedItems[index].date = newDate;
    setScanResult({ ...scanResult, items: updatedItems });
  };

  // Save parsed receipt into budget
  const handleSaveToBudget = () => {
    if (!scanResult) return;
    setError(null);

    const selectedItems = scanResult.items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setError('Wybierz przynajmniej jedną pozycję z paragonu do zapisania.');
      return;
    }

    try {
      const incomeItems = selectedItems.filter((i) => i.type === 'income');
      const expenseItems = selectedItems.filter((i) => i.type !== 'income');
      const incomeTotal = incomeItems.reduce((s, i) => s + i.price, 0);
      const expenseTotal = expenseItems.reduce((s, i) => s + i.price, 0);

      if (saveMode === 'individual') {
        // Każda pozycja osobno jako niezależna transakcja z własną datą i właściwym typem (wydatek lub wpływ)
        selectedItems.forEach((item) => {
          const itemPrice = parseFloat(item.price.toFixed(2));
          const itemDate = item.date || scanResult.date;
          const itemType: TransactionType = item.type === 'income' ? 'income' : 'expense';
          const defaultCategory = itemType === 'income' ? 'Inne wpływy' : (scanResult.dominantCategory || 'Inne wydatki');
          const cat = item.category || defaultCategory;

          if (onAddTransaction) {
            onAddTransaction({
              type: itemType,
              amount: itemPrice,
              category: cat,
              date: itemDate,
              title: item.name,
              comment: `${itemType === 'income' ? 'Wpływ' : 'Wydatek'} z dokumentu: ${scanResult.storeName || 'Skan'}${item.notes ? ` • ${item.notes}` : ''}`,
              receiptStoreName: scanResult.storeName,
              receiptItems: [{ ...item, type: itemType, date: itemDate }],
            });
          } else if (onReceiptScanned) {
            onReceiptScanned({
              title: item.name,
              amount: itemPrice,
              category: cat,
              date: itemDate,
              items: [{ name: item.name, price: item.price, quantity: item.quantity }],
            });
          }
        });

        const uniqueDates = Array.from(new Set(selectedItems.map((i) => i.date || scanResult.date)));
        const datesInfo = uniqueDates.length > 1
          ? ` w ${uniqueDates.length} różnych datach`
          : ` z datą ${uniqueDates[0] || scanResult.date}`;

        const summaryParts: string[] = [];
        if (incomeItems.length > 0) {
          summaryParts.push(`${incomeItems.length} wpływów (+${incomeTotal.toFixed(2)} PLN)`);
        }
        if (expenseItems.length > 0) {
          summaryParts.push(`${expenseItems.length} wydatków (${expenseTotal.toFixed(2)} PLN)`);
        }

        setSuccessMessage(
          `Pomyślnie dodano ${selectedItems.length} osobnych transakcji (${summaryParts.join(', ')})${datesInfo}!`
        );
      } else if (saveMode === 'by_category') {
        // Grupuj pozycje według (typ + data + kategoria), aby zachować podział na wpływy i wydatki oraz różne daty!
        const groupsMap: Record<string, { type: TransactionType; category: string; date: string; total: number; items: ReceiptItemDetail[] }> = {};
        selectedItems.forEach((item) => {
          const itemDate = item.date || scanResult.date;
          const itemType: TransactionType = item.type === 'income' ? 'income' : 'expense';
          const groupKey = `${itemType}___${itemDate}___${item.category}`;
          if (!groupsMap[groupKey]) {
            groupsMap[groupKey] = {
              type: itemType,
              category: item.category,
              date: itemDate,
              total: 0,
              items: [],
            };
          }
          groupsMap[groupKey].total += item.price;
          groupsMap[groupKey].items.push(item);
        });

        Object.values(groupsMap).forEach((group) => {
          const catAmount = parseFloat(group.total.toFixed(2));
          const isInc = group.type === 'income';
          if (onAddTransaction) {
            onAddTransaction({
              type: group.type,
              amount: catAmount,
              category: group.category,
              date: group.date,
              title: `${scanResult.storeName} (${isInc ? 'Wpływ' : 'Wydatek'}: ${group.category})`,
              comment: `${isInc ? 'Wpływy' : 'Wydatki'} (${group.items.length}): ${group.items.map((i) => i.name).join(', ')}`,
              receiptStoreName: scanResult.storeName,
              receiptItems: group.items,
            });
          } else if (onReceiptScanned) {
            onReceiptScanned({
              title: `${scanResult.storeName} (${group.category})`,
              amount: catAmount,
              category: group.category,
              date: group.date,
              items: group.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
            });
          }
        });

        const uniqueDates = Array.from(new Set(Object.values(groupsMap).map((g) => g.date)));
        const datesInfo = uniqueDates.length > 1 ? ` w ${uniqueDates.length} różnych terminach` : '';

        setSuccessMessage(
          `Pomyślnie dodano ${Object.keys(groupsMap).length} pogrupowanych transakcji (wpływy/wydatki według kategorii i dat${datesInfo})!`
        );
      } else {
        // Jeden zbiorczy zapis - jeśli są zarówno wydatki jak i wpływy, utwórz po 1 transakcji dla każdego typu
        let createdCount = 0;
        if (expenseItems.length > 0) {
          const totalExpense = parseFloat(expenseTotal.toFixed(2));
          if (onAddTransaction) {
            onAddTransaction({
              type: 'expense',
              amount: totalExpense,
              category: scanResult.dominantCategory || 'Inne wydatki',
              date: scanResult.date,
              title: `${scanResult.storeName} (Wydatki zbiorczo)`,
              comment: `Zakup ${expenseItems.length} pozycji. Sklep/Dokument: ${scanResult.storeName}. ${scanResult.summary || ''}`,
              receiptStoreName: scanResult.storeName,
              receiptItems: expenseItems,
            });
          } else if (onReceiptScanned) {
            onReceiptScanned({
              title: `Paragon: ${scanResult.storeName}`,
              amount: totalExpense,
              category: scanResult.dominantCategory,
              date: scanResult.date,
              items: expenseItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
            });
          }
          createdCount++;
        }

        if (incomeItems.length > 0) {
          const totalIncomeVal = parseFloat(incomeTotal.toFixed(2));
          const dominantIncomeCat = (INITIAL_INCOME_CATEGORIES as readonly string[]).includes(scanResult.dominantCategory)
            ? scanResult.dominantCategory
            : (incomeItems[0]?.category || 'Inne wpływy');

          if (onAddTransaction) {
            onAddTransaction({
              type: 'income',
              amount: totalIncomeVal,
              category: dominantIncomeCat,
              date: scanResult.date,
              title: `${scanResult.storeName} (Wpływy zbiorczo)`,
              comment: `Wpływ ${incomeItems.length} pozycji z wyciągu/dokumentu: ${scanResult.storeName}.`,
              receiptStoreName: scanResult.storeName,
              receiptItems: incomeItems,
            });
          } else if (onReceiptScanned && expenseItems.length === 0) {
            onReceiptScanned({
              title: `Wpływ: ${scanResult.storeName}`,
              amount: totalIncomeVal,
              category: dominantIncomeCat,
              date: scanResult.date,
              items: incomeItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
            });
          }
          createdCount++;
        }

        const detailsMsg: string[] = [];
        if (expenseItems.length > 0) detailsMsg.push(`wydatki: ${expenseTotal.toFixed(2)} PLN`);
        if (incomeItems.length > 0) detailsMsg.push(`wpływy: +${incomeTotal.toFixed(2)} PLN`);

        setSuccessMessage(
          `Pomyślnie dodano ${createdCount} transakcję(-e) zbiorczą(-e) (${detailsMsg.join(', ')}) ze źródła ${scanResult.storeName}!`
        );
      }
    } catch (err: any) {
      console.error('Błąd zapisu paragonu:', err);
      setError(err?.message || 'Wystąpił błąd podczas zatwierdzania paragonu. Spróbuj ponownie.');
    }
  };

  const selectedItems = scanResult?.items.filter((i) => i.selected) || [];
  const selectedExpenses = selectedItems.filter((i) => i.type !== 'income');
  const selectedIncomes = selectedItems.filter((i) => i.type === 'income');
  const selectedExpenseTotal = selectedExpenses.reduce((s, i) => s + i.price, 0);
  const selectedIncomeTotal = selectedIncomes.reduce((s, i) => s + i.price, 0);
  const selectedTotal = selectedItems.reduce((s, i) => s + i.price, 0);
  const hasIncomes = (scanResult?.items || []).some((i) => i.type === 'income');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Inteligentny Skaner Paragonów AI</h1>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1.5 transition-all cursor-pointer ${
                aiStatus.isConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
              title="Kliknij, aby zarządzać kluczem Gemini API"
            >
              {aiStatus.isConfigured ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {aiStatus.source === 'server'
                      ? 'Gemini AI Połączony (Backend)'
                      : aiStatus.source === 'client_env'
                      ? 'Gemini AI Połączony (GitHub Pages)'
                      : 'Gemini AI Połączony (Klucz własny)'}
                  </span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>Skonfiguruj Gemini API</span>
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Zrób zdjęcie lub wgraj paragon. Model Gemini AI automatycznie odczyta pozycje, ceny i przypisze kategorie
            (np. jedzenie, obiad, remont, koty).
          </p>
        </div>

        {/* Sample Load Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500">Przetestuj z przykładu:</span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_RECEIPTS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleLoadSample(sample)}
                className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors flex items-center space-x-1"
              >
                <span>{sample.title.split(' - ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Konfiguracja Gemini API</h3>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Wprowadź swój bezpłatny klucz API z Google AI Studio, aby korzystać ze skanera paragonów bezpośrednio na stronie GitHub Pages lub w przeglądarce.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Klucz GEMINI_API_KEY
              </label>
              <input
                type="password"
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Skąd wziąć darmowy klucz?</p>
              <p>
                1. Wejdź na <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">aistudio.google.com/app/apikey</a>.
              </p>
              <p>2. Wygeneruj klucz i wklej go tutaj (klucz zapisze się lokalnie w Twojej przeglądarce).</p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
              >
                Zapisz klucz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Missing Notice */}
      {!aiStatus.isConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs sm:text-sm flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Klucz GEMINI_API_KEY nie został skonfigurowany w środowisku.</p>
              <p className="text-amber-700 text-xs">
                Aby skanować własne zdjęcia z paragonami za pomocą Gemini AI na GitHub Pages, kliknij przycisk obok i wklej swój klucz API lub użyj gotowych przykładów testowych.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex-shrink-0 shadow-xs transition-colors"
          >
            Wpisz klucz
          </button>
        </div>
      )}

      {/* Main Upload / Scan Area */}
      {!scanResult && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processFile(e.dataTransfer.files[0]);
            }
          }}
          className={`bg-white rounded-2xl p-8 border transition-all text-center shadow-xs ${
            isDraggingOver
              ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-500/10 scale-[1.01]'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf,.pdf"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {pasteNotice && (
            <div className="mb-4 inline-flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-full shadow-2xs animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{pasteNotice}</span>
            </div>
          )}

          {imagePreview ? (
            <div className="max-w-md mx-auto space-y-4">
              {selectedFile?.type === 'application/pdf' ||
              Boolean(selectedFile?.name?.toLowerCase().endsWith('.pdf')) ||
              imagePreview.startsWith('data:application/pdf') ? (
                <div className="p-6 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">
                        DOKUMENT PDF
                      </span>
                      <span className="text-sm font-bold text-slate-800 truncate max-w-[240px]">
                        {selectedFile?.name || 'Dokument faktury / wyciągu.pdf'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB • ` : ''}
                      Plik PDF gotowy do odczytu danych przez Gemini AI
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner max-h-80 flex items-center justify-center bg-slate-50">
                  <img
                    src={imagePreview}
                    alt="Podgląd dokumentu"
                    className="max-h-80 object-contain mx-auto"
                  />
                </div>
              )}

              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => handleScanReceipt()}
                  disabled={isScanning}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-xl flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analizowanie dokumentu przez Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-300" />
                      <span>Rozpocznij skanowanie AI</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Zmień plik
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto py-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Wgraj paragon, fakturę lub wyciąg PDF</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Obsługiwane: <strong>pliki PDF (wyciągi, faktury)</strong> oraz zdjęcia <strong>JPG, PNG, WEBP</strong>. Możesz przeciągnąć plik lub wkleić ze schowka.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Wybierz plik z dysku</span>
                </button>
                <button
                  onClick={handlePasteFromClipboardClick}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-2xs cursor-pointer"
                  title="Wklej zrzut ekranu lub plik ze schowka (lub naciśnij Ctrl+V)"
                >
                  <Clipboard className="w-4 h-4 text-indigo-600" />
                  <span>Wklej ze schowka (Ctrl+V)</span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>Aparat</span>
                </button>
              </div>

              <div className="mt-5 inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                <Clipboard className="w-3.5 h-3.5 text-indigo-500" />
                <span>Możesz w dowolnym momencie wcisnąć <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px] text-slate-700 font-semibold shadow-2xs">Ctrl + V</kbd> (lub <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px] text-slate-700 font-semibold shadow-2xs">⌘ + V</kbd>), aby wkleić zrzut ekranu</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs sm:text-sm text-left flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {scanResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Box */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={scanResult.storeName}
                      onChange={(e) => setScanResult({ ...scanResult, storeName: e.target.value })}
                      placeholder="Nazwa sklepu / sprzedawcy"
                      className="text-base sm:text-lg font-bold text-slate-900 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden transition-colors"
                      title="Możesz edytować nazwę sklepu"
                    />
                    <select
                      value={scanResult.dominantCategory}
                      onChange={(e) => setScanResult({ ...scanResult, dominantCategory: e.target.value })}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <optgroup label="Kategorie wydatków">
                        {INITIAL_CATEGORIES.map((cat) => (
                          <option key={cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Kategorie wpływów">
                        {INITIAL_INCOME_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Data zakupu / wyciągu:</span>
                      <input
                        type="date"
                        value={scanResult.date}
                        onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                        className="border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-800 bg-white font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </span>
                    {scanResult.receiptNumber && <span>Nr: {scanResult.receiptNumber}</span>}
                  </div>
                </div>
              </div>

              <div className="text-left md:text-right shrink-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl border md:border-0 border-slate-100 space-y-1">
                {hasIncomes ? (
                  <>
                    <div className="flex items-center md:justify-end gap-2 text-xs">
                      <span className="text-slate-500">Wydatki:</span>
                      <span className="font-bold text-slate-800">{selectedExpenseTotal.toFixed(2)} PLN</span>
                    </div>
                    <div className="flex items-center md:justify-end gap-2 text-xs">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Wpływy:
                      </span>
                      <span className="font-bold text-emerald-700">+{selectedIncomeTotal.toFixed(2)} PLN</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200/80">
                      <span className="text-[11px] text-slate-400 block">Bilans dokumentu</span>
                      <span className={`text-xl font-black ${selectedIncomeTotal - selectedExpenseTotal >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {(selectedIncomeTotal - selectedExpenseTotal).toFixed(2)} PLN
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-500 block">Suma z paragonu</span>
                    <span className="text-2xl font-black text-slate-900">
                      {scanResult.totalAmount.toFixed(2)} PLN
                    </span>
                  </>
                )}
              </div>
            </div>

            {scanResult.summary && (
              <p className="text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                💡 <span className="font-semibold">Podsumowanie AI:</span> {scanResult.summary}
              </p>
            )}
          </div>

          {/* Itemized Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Odczytane pozycje ({scanResult.items.length})
                </h3>
              </div>
            </div>

            {/* Wybór sposobu zapisu do budżetu (np. dla paragonów, faktur lub zbiorczych list PDF) */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Sposób zapisu do budżetu:
                </span>
                <span className="text-[11px] text-slate-500">
                  Dla wyciągów i zestawień możesz zapisać każdą operację osobno z jej własną datą i typem (wpływ/wydatek)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Zbiorczy paragon */}
                <button
                  type="button"
                  onClick={() => setSaveMode('consolidated')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    saveMode === 'consolidated'
                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Receipt className={`w-4 h-4 ${saveMode === 'consolidated' ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold">1 paragon / zbiorczo</span>
                    </div>
                    {saveMode === 'consolidated' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {hasIncomes
                      ? 'Utworzy zbiorcze transakcje (oddzielnie dla wpływów i wydatków) ze szczegółami pozycji.'
                      : 'Pojedynczy wydatek na łączną sumę ze wszystkimi produktami w szczegółach.'}
                  </p>
                </button>

                {/* 2. Grupowanie w kategorie */}
                <button
                  type="button"
                  onClick={() => setSaveMode('by_category')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    saveMode === 'by_category'
                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Layers className={`w-4 h-4 ${saveMode === 'by_category' ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold">Grupuj w kategorie</span>
                    </div>
                    {saveMode === 'by_category' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Grupuj pozycje według kategorii, dat oraz typu operacji (wpływ vs wydatek).
                  </p>
                </button>

                {/* 3. Osobno każda pozycja */}
                <button
                  type="button"
                  onClick={() => setSaveMode('individual')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    saveMode === 'individual'
                      ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <ListPlus className={`w-4 h-4 ${saveMode === 'individual' ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold">Osobno każda pozycja</span>
                    </div>
                    {saveMode === 'individual' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Każda linia jako niezależna transakcja z indywidualną datą i właściwym typem (wpływ/wydatek).
                  </p>
                </button>
              </div>

              {/* Dynamiczny wskaźnik wyniku wybranego trybu */}
              <div className="text-[11px] text-indigo-900 bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-indigo-100/80 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {saveMode === 'consolidated' && (
                    hasIncomes && selectedExpenses.length > 0
                      ? 'Efekt: Zostaną utworzone 2 transakcje zbiorcze (1 dla wydatków, 1 dla wpływów).'
                      : 'Efekt: Zostanie utworzona 1 transakcja w budżecie.'
                  )}
                  {saveMode === 'by_category' && (() => {
                    const groupsCount = new Set(selectedItems.map((i) => `${i.type}___${i.date || scanResult.date}___${i.category}`)).size;
                    return `Efekt: Zostaną utworzone ${groupsCount} transakcje według kategorii, dat i typów.`;
                  })()}
                  {saveMode === 'individual' &&
                    `Efekt: Zostanie utworzonych ${selectedItems.length} osobnych transakcji w budżecie (z własnymi datami i typami).`}
                </span>
                <div className="flex items-center space-x-3 text-xs">
                  {selectedIncomes.length > 0 && (
                    <span className="font-bold text-emerald-700">
                      Wpływy: +{selectedIncomeTotal.toFixed(2)} PLN
                    </span>
                  )}
                  {selectedExpenses.length > 0 && (
                    <span className="font-bold text-slate-900">
                      Wydatki: {selectedExpenseTotal.toFixed(2)} PLN
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {scanResult.items.map((item, idx) => {
                const isIncome = item.type === 'income';
                return (
                  <div
                    key={idx}
                    className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                      !item.selected ? 'opacity-50 bg-slate-50/50' : isIncome ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0 w-full sm:w-auto">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleItem(idx)}
                        className="rounded-sm text-slate-900 focus:ring-slate-900 w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScanResult((prev) => {
                              if (!prev) return null;
                              const newItems = [...prev.items];
                              newItems[idx] = { ...newItems[idx], name: val };
                              return { ...prev, items: newItems };
                            });
                          }}
                          className="text-xs sm:text-sm font-semibold text-slate-900 w-full bg-transparent hover:bg-slate-50 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-hidden px-1 py-0.5 rounded-sm"
                          title="Kliknij, aby poprawić nazwę pozycji"
                        />
                        {item.notes && <p className="text-[11px] text-slate-500 px-1">{item.notes}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Przełącznik typu: Wydatek vs Wpływ */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemType(idx)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          isIncome
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Kliknij, aby przełączyć między Wpływem a Wydatkiem"
                      >
                        {isIncome ? (
                          <>
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Wpływ</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                            <span>Wydatek</span>
                          </>
                        )}
                      </button>

                      {/* Individual Date for item (important for bank statements / multi-date PDFs) */}
                      <div
                        className="flex items-center space-x-1 bg-slate-100/90 border border-slate-200 rounded-xl px-2 py-1"
                        title="Data tej konkretnej operacji/pozycji (przydatne przy wyciągach bankowych i zestawieniach PDF)"
                      >
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <input
                          type="date"
                          value={item.date || scanResult.date}
                          onChange={(e) => handleItemDateChange(idx, e.target.value)}
                          className="text-[11px] bg-transparent text-slate-700 font-medium focus:outline-hidden cursor-pointer"
                        />
                      </div>

                      {/* Category Selector for individual item */}
                      <select
                        value={item.category}
                        onChange={(e) => handleItemCategoryChange(idx, e.target.value)}
                        className={`text-xs border rounded-xl px-2.5 py-1.5 font-medium focus:outline-hidden focus:ring-1 ${
                          isIncome
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 focus:ring-emerald-500'
                            : 'bg-slate-100 border-slate-200 text-slate-700 focus:ring-indigo-500'
                        }`}
                      >
                        {isIncome ? (
                          <optgroup label="Kategorie wpływów">
                            {INITIAL_INCOME_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </optgroup>
                        ) : (
                          <optgroup label="Kategorie wydatków">
                            {INITIAL_CATEGORIES.map((cat) => (
                              <option key={cat.name} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      {/* Price with edit ability */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setScanResult((prev) => {
                              if (!prev) return null;
                              const newItems = [...prev.items];
                              newItems[idx] = { ...newItems[idx], price: val };
                              return { ...prev, items: newItems };
                            });
                          }}
                          className={`w-20 text-right text-xs sm:text-sm font-bold bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-md px-1 py-0.5 focus:outline-hidden ${
                            isIncome
                              ? 'text-emerald-700 focus:border-emerald-500'
                              : 'text-slate-900 focus:border-indigo-500'
                          }`}
                        />
                        <span className={`text-xs font-bold ${isIncome ? 'text-emerald-700' : 'text-slate-600'}`}>
                          zł
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>
                  Wybrano pozycji: <span className="font-bold text-slate-900">{selectedItems.length}</span> z {scanResult.items.length}
                </div>
                <div className="flex items-center space-x-2 text-[11px]">
                  {selectedIncomes.length > 0 && (
                    <span className="font-semibold text-emerald-700">
                      Wpływy: +{selectedIncomeTotal.toFixed(2)} PLN
                    </span>
                  )}
                  {selectedExpenses.length > 0 && (
                    <span className="font-semibold text-slate-700">
                      Wydatki: {selectedExpenseTotal.toFixed(2)} PLN
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setScanResult(null);
                    setImagePreview(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Skanuj kolejny
                </button>

                <button
                  onClick={handleSaveToBudget}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Zapisz w budżecie</span>
                </button>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
              <button
                onClick={onNavigateToTransactions}
                className="text-xs font-bold text-emerald-700 underline flex items-center space-x-1 hover:text-emerald-900"
              >
                <span>Przejdź do transakcji</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
