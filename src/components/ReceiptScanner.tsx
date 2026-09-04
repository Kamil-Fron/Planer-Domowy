import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { ReceiptItemDetail, ReceiptScanResult, Transaction, ShoppingItem } from '../types';
import { INITIAL_CATEGORIES, SAMPLE_RECEIPTS } from '../mockData';
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
  const [splitByCategory, setSplitByCategory] = useState(false);
  
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

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      setSuccessMessage(null);
      setScanResult(null);

      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
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
        // Initialize selection status
        const itemsWithSelection: ReceiptItemDetail[] = (data.items || []).map((item: any) => ({
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          category: item.category || data.dominantCategory || 'Jedzenie i artykuły spożywcze',
          notes: item.notes || '',
          selected: true,
        }));

        setScanResult({
          storeName: data.storeName || 'Sklep',
          date: data.date || new Date().toISOString().split('T')[0],
          totalAmount: Number(data.totalAmount) || itemsWithSelection.reduce((s, i) => s + i.price, 0),
          currency: data.currency || 'PLN',
          receiptNumber: data.receiptNumber || '',
          dominantCategory: data.dominantCategory || 'Jedzenie i artykuły spożywcze',
          summary: data.summary || 'Pomyślnie przeanalizowano pozycje paragonu.',
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
    setScanResult({
      storeName: sample.storeName,
      date: sample.date,
      totalAmount: sample.totalAmount,
      currency: sample.currency,
      dominantCategory: sample.dominantCategory,
      summary: sample.summary,
      items: sample.items.map((i) => ({ ...i, selected: true })),
    });
  };

  // Toggle item selection
  const handleToggleItem = (index: number) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    updatedItems[index].selected = !updatedItems[index].selected;
    setScanResult({ ...scanResult, items: updatedItems });
  };

  // Update category of an individual item
  const handleItemCategoryChange = (index: number, newCat: string) => {
    if (!scanResult) return;
    const updatedItems = [...scanResult.items];
    updatedItems[index].category = newCat;
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
      if (splitByCategory) {
        // Group items by category and create separate transaction per category
        const categoriesMap: Record<string, { total: number; items: ReceiptItemDetail[] }> = {};
        selectedItems.forEach((item) => {
          if (!categoriesMap[item.category]) {
            categoriesMap[item.category] = { total: 0, items: [] };
          }
          categoriesMap[item.category].total += item.price;
          categoriesMap[item.category].items.push(item);
        });

        Object.entries(categoriesMap).forEach(([catName, group]) => {
          const catAmount = parseFloat(group.total.toFixed(2));
          if (onAddTransaction) {
            onAddTransaction({
              type: 'expense',
              amount: catAmount,
              category: catName,
              date: scanResult.date,
              title: `Paragon: ${scanResult.storeName} (${catName})`,
              comment: `Produkty (${group.items.length}): ${group.items.map((i) => i.name).join(', ')}`,
              receiptStoreName: scanResult.storeName,
              receiptItems: group.items,
            });
          } else if (onReceiptScanned) {
            onReceiptScanned({
              title: `Paragon: ${scanResult.storeName} (${catName})`,
              amount: catAmount,
              category: catName,
              date: scanResult.date,
              items: group.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
            });
          }
        });
      } else {
        // Create single consolidated transaction
        const totalSelected = parseFloat(selectedItems.reduce((s, i) => s + i.price, 0).toFixed(2));
        if (onAddTransaction) {
          onAddTransaction({
            type: 'expense',
            amount: totalSelected,
            category: scanResult.dominantCategory,
            date: scanResult.date,
            title: `Paragon: ${scanResult.storeName}`,
            comment: `Zakup ${selectedItems.length} pozycji. Sklep: ${scanResult.storeName}. ${scanResult.summary || ''}`,
            receiptStoreName: scanResult.storeName,
            receiptItems: selectedItems,
          });
        } else if (onReceiptScanned) {
          onReceiptScanned({
            title: `Paragon: ${scanResult.storeName}`,
            amount: totalSelected,
            category: scanResult.dominantCategory,
            date: scanResult.date,
            items: selectedItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
          });
        }
      }

      setSuccessMessage(`Pomyślnie dodano wydatek z paragonu (${selectedTotal.toFixed(2)} PLN) do budżetu domowego!`);
    } catch (err: any) {
      console.error('Błąd zapisu paragonu:', err);
      setError(err?.message || 'Wystąpił błąd podczas zatwierdzania paragonu. Spróbuj ponownie.');
    }
  };

  const selectedTotal =
    scanResult?.items.filter((i) => i.selected).reduce((s, i) => s + i.price, 0) || 0;

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
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              const file = e.dataTransfer.files[0];
              setSelectedFile(file);
              setError(null);
              setSuccessMessage(null);
              setScanResult(null);

              const reader = new FileReader();
              reader.onload = () => {
                setImagePreview(reader.result as string);
              };
              reader.readAsDataURL(file);
            }
          }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center hover:border-indigo-300 transition-colors"
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
                        {selectedFile?.name || 'Dokument faktury / rachunku.pdf'}
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
              <h3 className="text-lg font-bold text-slate-900">Wgraj paragon lub plik PDF</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Obsługiwane formaty: <strong>PDF (faktury, rachunki)</strong> oraz zdjęcia <strong>JPG, PNG, WEBP</strong>. Możesz przeciągnąć plik tutaj.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Wybierz plik (PDF lub zdjęcie)</span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>Zrób zdjęcie aparatem</span>
                </button>
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
                      {INITIAL_CATEGORIES.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Data zakupu:</span>
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

              <div className="text-left md:text-right shrink-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl border md:border-0 border-slate-100">
                <span className="text-xs text-slate-500 block">Suma z paragonu</span>
                <span className="text-2xl font-black text-slate-900">
                  {scanResult.totalAmount.toFixed(2)} PLN
                </span>
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

              {/* Split Category Toggle */}
              <div className="flex items-center space-x-2 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={splitByCategory}
                    onChange={(e) => setSplitByCategory(e.target.checked)}
                    className="rounded-sm text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-medium text-slate-700">
                    Rozdziel na osobne wydatki według kategorii w budżecie
                  </span>
                </label>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {scanResult.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                    !item.selected ? 'opacity-50 bg-slate-50/50' : ''
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

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Category Selector for individual item */}
                    <select
                      value={item.category}
                      onChange={(e) => handleItemCategoryChange(idx, e.target.value)}
                      className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      {INITIAL_CATEGORIES.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
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
                        className="w-20 text-right text-xs sm:text-sm font-bold text-slate-900 bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md px-1 py-0.5 focus:outline-hidden"
                      />
                      <span className="text-xs font-bold text-slate-600">zł</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                Wybrano pozycji: <span className="font-bold text-slate-900">{scanResult.items.filter((i) => i.selected).length}</span> z {scanResult.items.length} (Suma wybranych: <span className="font-bold text-slate-900">{selectedTotal.toFixed(2)} PLN</span>)
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
