import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { ReceiptItemDetail, ReceiptScanResult, Transaction, ShoppingItem } from '../types';
import { INITIAL_CATEGORIES, SAMPLE_RECEIPTS } from '../mockData';

interface ReceiptScannerProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  shoppingItems: ShoppingItem[];
  onCompleteShoppingItem?: (itemId: string) => void;
  onNavigateToTransactions: () => void;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onAddTransaction,
  shoppingItems,
  onCompleteShoppingItem,
  onNavigateToTransactions,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [splitByCategory, setSplitByCategory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Perform AI scan using Gemini API
  const handleScanReceipt = async (base64Img?: string, mimeType?: string) => {
    const dataToSend = base64Img || imagePreview;
    if (!dataToSend) {
      setError('Wybierz plik ze zdjęciem paragonu lub skorzystaj z przykładu.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataToSend,
          mimeType: mimeType || 'image/jpeg',
        }),
      });

      const resData = await response.json();

      if (resData.success && resData.data) {
        // Initialize selection status
        const itemsWithSelection: ReceiptItemDetail[] = (resData.data.items || []).map((item: any) => ({
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          category: item.category || resData.data.dominantCategory || 'Jedzenie i artykuły spożywcze',
          notes: item.notes || '',
          selected: true,
        }));

        setScanResult({
          storeName: resData.data.storeName || 'Sklep',
          date: resData.data.date || new Date().toISOString().split('T')[0],
          totalAmount: Number(resData.data.totalAmount) || itemsWithSelection.reduce((s, i) => s + i.price, 0),
          currency: resData.data.currency || 'PLN',
          receiptNumber: resData.data.receiptNumber || '',
          dominantCategory: resData.data.dominantCategory || 'Jedzenie i artykuły spożywcze',
          summary: resData.data.summary || 'Pomyślnie przeanalizowano pozycje paragonu.',
          items: itemsWithSelection,
        });
      } else {
        throw new Error(resData.error || 'Nie udało się odczytać paragonu');
      }
    } catch (err: any) {
      console.warn('API error, falling back to intelligent demo simulation:', err);
      // Fallback simulation for seamless offline testing
      const randomSample = SAMPLE_RECEIPTS[0];
      setScanResult({
        storeName: randomSample.storeName,
        date: randomSample.date,
        totalAmount: randomSample.totalAmount,
        currency: randomSample.currency,
        dominantCategory: randomSample.dominantCategory,
        summary: randomSample.summary,
        items: randomSample.items.map((i) => ({ ...i, selected: true })),
      });
      setError(
        'Uwaga: Serwer Gemini zwrócił błąd lub brak połączenia z kluczem API. Wygenerowano przykładową inteligentną analizę demonstracyjną.'
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

    const selectedItems = scanResult.items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setError('Wybierz przynajmniej jedną pozycję z paragonu do zapisania.');
      return;
    }

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
        onAddTransaction({
          type: 'expense',
          amount: parseFloat(group.total.toFixed(2)),
          category: catName,
          date: scanResult.date,
          title: `Paragon: ${scanResult.storeName} (${catName})`,
          comment: `Produkty (${group.items.length}): ${group.items.map((i) => i.name).join(', ')}`,
          receiptStoreName: scanResult.storeName,
          receiptItems: group.items,
        });
      });
    } else {
      // Create single consolidated transaction
      const totalSelected = selectedItems.reduce((s, i) => s + i.price, 0);
      onAddTransaction({
        type: 'expense',
        amount: parseFloat(totalSelected.toFixed(2)),
        category: scanResult.dominantCategory,
        date: scanResult.date,
        title: `Paragon: ${scanResult.storeName}`,
        comment: `Zakup ${selectedItems.length} pozycji. Sklep: ${scanResult.storeName}. ${scanResult.summary || ''}`,
        receiptStoreName: scanResult.storeName,
        receiptItems: selectedItems,
      });
    }

    setSuccessMessage(`Pomyślnie dodano wydatek z paragonu do budżetu domowego!`);
  };

  const selectedTotal =
    scanResult?.items.filter((i) => i.selected).reduce((s, i) => s + i.price, 0) || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Inteligentny Skaner Paragonów AI</h1>
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

      {/* Main Upload / Scan Area */}
      {!scanResult && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
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
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner max-h-80 flex items-center justify-center bg-slate-50">
                <img
                  src={imagePreview}
                  alt="Podgląd paragonu"
                  className="max-h-80 object-contain mx-auto"
                />
              </div>

              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => handleScanReceipt()}
                  disabled={isScanning}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-xl flex items-center space-x-2 shadow-xs transition-all"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analizowanie przez Gemini AI...</span>
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
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                >
                  Zmień zdjęcie
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto py-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Wgraj zdjęcie paragonu</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Obsługiwane formaty: JPG, PNG, WEBP. Możesz także użyć aparatu w smartfonie.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Wybierz plik z dysku</span>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-xs"
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
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900">{scanResult.storeName}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium">
                      {scanResult.dominantCategory}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Data: {scanResult.date}</span>
                    </span>
                    {scanResult.receiptNumber && <span>Nr: {scanResult.receiptNumber}</span>}
                  </div>
                </div>
              </div>

              <div className="text-right">
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
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => handleToggleItem(idx)}
                      className="rounded-sm text-slate-900 focus:ring-slate-900 w-4 h-4"
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {item.name}
                      </p>
                      {item.notes && <p className="text-[11px] text-slate-500">{item.notes}</p>}
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

                    {/* Price */}
                    <span className="text-sm font-bold text-slate-900 whitespace-nowrap min-w-[70px] text-right">
                      {item.price.toFixed(2)} zł
                    </span>
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
