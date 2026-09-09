import { compressImageBase64 } from "../utils/imageCompressor";
import { resolveRelativeDate, toLocalISODate } from "../utils/dateParser";

// Helper to retrieve the Gemini API key from environment or local storage
export function getStoredGeminiApiKey(): string {
  // 1. Check localStorage if user manually set it
  const localKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }

  // 2. Check Vite env variables injected during build (e.g. GitHub Actions)
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (viteKey && typeof viteKey === "string" && viteKey.trim() && viteKey !== "MY_GEMINI_API_KEY") {
    return viteKey.trim();
  }

  // 3. Check generic env
  const genericKey = (import.meta.env as any).GEMINI_API_KEY;
  if (genericKey && typeof genericKey === "string" && genericKey.trim()) {
    return genericKey.trim();
  }

  return "";
}

export function saveStoredGeminiApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key.trim()) {
      localStorage.setItem("gemini_api_key", key.trim());
    } else {
      localStorage.removeItem("gemini_api_key");
    }
  }
}

export interface AiStatusResult {
  isConfigured: boolean;
  source: "server" | "client_env" | "client_storage" | "none";
  message: string;
}

// Check AI availability (hybrid: tests server backend first, falls back to client key)
export async function checkAiAvailability(): Promise<AiStatusResult> {
  // 1. Test server backend endpoint
  try {
    const res = await fetch("/api/health", { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.hasApiKey) {
        return {
          isConfigured: true,
          source: "server",
          message: "Połączono z serwerem AI (Backend)",
        };
      }
    }
  } catch {
    // Backend not running (e.g. static GitHub Pages) - ignore and check client key
  }

  // 2. Check client-side injected key (from GitHub Actions secret or .env or localStorage)
  const clientKey = getStoredGeminiApiKey();
  if (clientKey) {
    const isFromStorage = typeof window !== "undefined" && Boolean(localStorage.getItem("gemini_api_key"));
    return {
      isConfigured: true,
      source: isFromStorage ? "client_storage" : "client_env",
      message: isFromStorage
        ? "Połączono z Gemini AI (Klucz własny)"
        : "Połączono z Gemini AI (Klucz wdrożeniowy GitHub Pages)",
    };
  }

  return {
    isConfigured: false,
    source: "none",
    message: "Brak skonfigurowanego klucza GEMINI_API_KEY",
  };
}

// Clean JSON extraction from AI response string (handles markdown, thinking blocks, and raw JSON)
function extractJson(rawInput: any): any {
  let text = "";
  if (typeof rawInput === "string") {
    text = rawInput;
  } else if (rawInput?.candidates?.[0]?.content?.parts) {
    const parts = rawInput.candidates[0].content.parts;
    // Prefer non-thought text parts
    const contentPart = parts.find((p: any) => !p.thought && p.text) || parts.find((p: any) => p.text);
    text = contentPart?.text || "";
  } else if (rawInput?.text) {
    text = rawInput.text;
  }

  if (!text || !text.trim()) {
    throw new Error("Model AI zwrócił pustą odpowiedź. Spróbuj wykonać wyraźniejsze zdjęcie paragonu.");
  }

  let cleaned = text.trim();
  if (cleaned.includes("```")) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
  }

  // Find first { and last }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned);
}

// Direct Client-Side Gemini Vision Scan (works seamlessly on GitHub Pages)
async function scanReceiptDirectClient(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  referenceDate?: string
): Promise<any> {
  const isPdf = mimeType === 'application/pdf' || imageBase64.startsWith('data:application/pdf');

  const today = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : toLocalISODate(new Date());

  const todayDateObj = new Date(today + 'T12:00:00');
  const daysOfWeekPl = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const currentDayName = daysOfWeekPl[todayDateObj.getDay()] || 'dzisiaj';

  const yesterdayDate = new Date(todayDateObj);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toLocalISODate(yesterdayDate);

  const dayBeforeYesterdayDate = new Date(todayDateObj);
  dayBeforeYesterdayDate.setDate(dayBeforeYesterdayDate.getDate() - 2);
  const dayBeforeYesterdayStr = toLocalISODate(dayBeforeYesterdayDate);

  let cleanBase64: string;
  let detectedMime: string;

  if (isPdf) {
    cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, '').trim();
    detectedMime = 'application/pdf';
  } else {
    // Compress high-res mobile image to ensure fast transfer (<400KB) and crisp OCR
    const { base64: compBase64, mimeType: compressedMime } = await compressImageBase64(
      imageBase64,
      1600,
      1600,
      0.85
    );
    cleanBase64 = compBase64;
    detectedMime = compressedMime || mimeType || 'image/jpeg';
  }

  const prompt = `Jesteś precyzyjnym systemem OCR i asystentem finansowym do analizy paragonów fiskalnych, faktur VAT, wyciągów bankowych oraz zestawień PDF i zrzutów ekranu (w tym Apple Pay / Apple Wallet / kart płatniczych) w Polsce.

BIEŻĄCY CZAS ODNIESIENIA:
- Dzisiejsza data: ${today} (${currentDayName})
- Wczorajsza data: ${yesterdayStr}
- Przedwczorajsza data: ${dayBeforeYesterdayStr}

SPECJALNA OBSŁUGA APPLE PAY / PORTFELA APPLE / APLIKACJI BANKOWYCH:
Na zrzutach ekranu z Apple Pay, Apple Wallet, Revolut i bankowości mobilnej transakcje są często grupowane pod nagłówkami relatywnymi ("DZIŚ", "WCZORAJ", "PONIEDZIAŁEK" itp.) lub mają jedynie godzinę (np. "14:20", "09:15") zamiast pełnej daty kalendarzowej:
- Każda pozycja pod nagłówkiem "Dziś" / "Dzisiaj" / "Today" lub oznaczona samą godziną -> przypisz date: "${today}"
- Każda pozycja pod nagłówkiem "Wczoraj" / "Yesterday" -> przypisz date: "${yesterdayStr}"
- Każda pozycja pod nagłówkiem "Przedwczoraj" -> przypisz date: "${dayBeforeYesterdayStr}"
- Pozycje pod nagłówkiem dnia tygodnia (np. "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela", "Monday", "Tuesday") -> wylicz datę ostatniego wystąpienia tego dnia tygodnia przed dzisiejszą datą (${today}) i podaj w formacie YYYY-MM-DD.
- NIGDY nie zwracaj tekstu "dziś" czy "wczoraj" w polach date – ZAWSZE przelicz na bezwzględną datę kalendarzową YYYY-MM-DD!

Przeanalizuj dołączony dokument (paragon, fakturę, wyciąg bankowy, zrzut Apple Pay lub plik PDF) i wyodrębnij:
1. storeName: Nazwa sklepu / stacji paliw / wystawcy faktury / banku / sprzedawcy / źródła (np. Apple Pay, Pieprzyk, Biedronka, Lidl, Orlen, Castorama, Rossmann, Tauron, mBank itp.).
2. date: Główna data dokumentu lub ostatniej operacji (w formacie YYYY-MM-DD). Jeśli niewidoczna, użyj bieżącej daty: ${today}.
3. totalAmount: Łączna kwota do zapłaty lub obrotu (liczba w PLN, np. 111.31).
4. currency: Waluta (zwykle "PLN").
5. receiptNumber: Numer paragonu, faktury, karty lub NIP (jeśli widoczny, inaczej "").
6. dominantCategory: Dominująca kategoria całego dokumentu (wydatek lub wpływ).
7. summary: Krótkie podsumowanie w języku polskim (np. "Zestawienie płatności Apple Pay" lub "Wyciąg z konta bankowego z wpływami i wydatkami").
8. items: Lista pozycji zakupowych, operacji lub opłat z dokumentu.
Dla KAŻDEJ pozycji wyodrębnij:
- name: nazwa produktu/usługi lub operacji
- type: 'expense' (jeśli to wydatek, zakup, opłata, obciążenie) LUB 'income' (jeśli to wpływ, wynagrodzenie, zwrot za towar, wpłata gotówki, pożyczka/kredyt, świadczenie 800+, sprzedaż, uznanie)
- price: kwota za pozycję (zawsze dodatnia liczba w PLN)
- quantity: ilość sztuk lub waga (liczba, domyślnie 1)
- category:
  * jeśli type='income', wybierz jedną z: ["Wypłata z etatu", "Premia / Bonus", "Gotówka", "Pożyczka / Kredyt", "Zwrot (zakupy, podatki)", "Freelance / Zlecenia", "Świadczenia / 800+", "Sprzedaż (Vinted, OLX)", "Prezent / Darowizna", "Odsetki / Inwestycje", "Alimenty", "Inne wpływy"]
  * jeśli type='expense', wybierz jedną z: ["Jedzenie i artykuły spożywcze", "Remont i dom", "Dla kotów i zwierząt", "Rachunki i media", "Zdrowie i kosmetyki", "Transport i paliwo", "Rozrywka i hobby", "Odzież i obuwie", "Edukacja i książki", "Inne wydatki"]
- date: dokładna data tej konkretnej pozycji w formacie YYYY-MM-DD (BARDZO WAŻNE: na wyciągach bankowych, zestawieniach Apple Pay oraz PDF pozycje mogą mieć różne daty operacji/księgowania - przypisz dla każdej pozycji jej faktyczną datę z dokumentu)
- notes: krótka notatka (np. opis, godzina płatności, metoda Apple Pay)

Zwróć wynik w czystym formacie JSON:
{
  "storeName": "string",
  "date": "YYYY-MM-DD",
  "totalAmount": 0.00,
  "currency": "PLN",
  "receiptNumber": "string",
  "dominantCategory": "string",
  "summary": "string",
  "items": [
    {
      "name": "string",
      "type": "expense",
      "price": 0.00,
      "quantity": 1,
      "category": "string",
      "date": "YYYY-MM-DD",
      "notes": "string"
    }
  ]
}`;

  // Use modern high-accuracy vision and reasoning models
  const models = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
              {
                inline_data: {
                  mime_type: detectedMime,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `Błąd API (${res.status} ${res.statusText})`;
        throw new Error(errMsg);
      }

      const resultData = await res.json();
      const extracted = extractJson(resultData);
      if (extracted) {
        extracted.date = resolveRelativeDate(extracted.date, today, extracted.summary);
        if (Array.isArray(extracted.items)) {
          extracted.items = extracted.items.map((item: any) => ({
            ...item,
            date: resolveRelativeDate(item.date, extracted.date || today, `${item.name || ''} ${item.notes || ''}`),
          }));
        }
      }
      return extracted;
    } catch (err: any) {
      console.warn(`Próba analizy modelem ${model} nie powiodła się:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Nie udało się przeanalizować paragonu przez Gemini API.");
}

// Direct Client-Side Gemini Financial Advice
async function getAdviceDirectClient(
  apiKey: string,
  params: {
    transactions: any[];
    limits: any[];
    bills: any[];
  }
): Promise<any> {
  const { transactions = [], limits = [], bills = [] } = params;

  const income = transactions
    .filter((t: any) => t.type === "income")
    .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

  const expenses = transactions
    .filter((t: any) => t.type === "expense")
    .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

  const catMap: Record<string, number> = {};
  transactions
    .filter((t: any) => t.type === "expense")
    .forEach((t: any) => {
      const cat = t.category || "Inne";
      catMap[cat] = (catMap[cat] || 0) + (Number(t.amount) || 0);
    });
  const categories = Object.entries(catMap).map(([category, amount]) => ({ category, amount }));

  const prompt = `Jesteś życzliwym, mądrym i pragmatycznym doradcą budżetu domowego w Polsce.
Przeanalizuj bieżący stan finansów użytkownika:
- Łączne dochody w tym miesiącu: ${income.toFixed(2)} PLN
- Łączne wydatki w tym miesiącu: ${expenses.toFixed(2)} PLN
- Bilans netto: ${(income - expenses).toFixed(2)} PLN
- Podział wydatków na kategorie: ${JSON.stringify(categories)}
- Ustawione limity budżetowe: ${JSON.stringify(limits)}
- Zbliżające się rachunki domowe: ${JSON.stringify(bills)}

Przygotuj zwięzłą, konkretną analizę w języku polskim w formacie JSON:
{
  "financialHealth": "Doskonała" | "Dobra" | "Umiarkowana" | "Wymaga uwagi",
  "savingsRatePercent": 20,
  "alerts": ["alert 1", "alert 2"],
  "actionableTips": ["wskazówka 1", "wskazówka 2", "wskazówka 3"],
  "summary": "Krótkie jednozdaniowe podsumowanie.",
  "fullText": "Pełny tekst analizy w punktach po polsku"
}`;

  const models = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Błąd API (${res.status})`);
      }

      const resultData = await res.json();
      return extractJson(resultData);
    } catch (err: any) {
      console.warn(`Próba generowania porady z modelem ${model} nie powiodła się:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Nie udało się wygenerować analizy finansowej.");
}

// Unified Service Call: Scan Receipt
export async function scanReceiptWithAI(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  referenceDate?: string
): Promise<any> {
  // Auto-detect PDF from base64 if needed
  let effectiveMime = mimeType;
  if (imageBase64.startsWith("data:application/pdf") || mimeType === "application/pdf") {
    effectiveMime = "application/pdf";
  }

  const todayStr = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : toLocalISODate(new Date());

  let resultData: any = null;

  // 1. Try server endpoint first (Node / Express backend in AI Studio)
  try {
    const response = await fetch("/api/scan-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType: effectiveMime, currentDate: todayStr }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.success && resData.data) {
        resultData = resData.data;
      }
    }
  } catch {
    // Ignore server error and fallback to direct client call
  }

  // 2. Fallback to client-side direct API call (e.g. GitHub Pages)
  if (!resultData) {
    const clientKey = getStoredGeminiApiKey();
    if (!clientKey) {
      throw new Error(
        "Klucz GEMINI_API_KEY nie został skonfigurowany. Kliknij przycisk 'Skonfiguruj Gemini API' i podaj swój klucz z Google AI Studio."
      );
    }

    resultData = await scanReceiptDirectClient(clientKey, imageBase64, effectiveMime, todayStr);
  }

  // Final verification & sanitization of relative dates for document and individual items
  if (resultData) {
    resultData.date = resolveRelativeDate(resultData.date, todayStr, resultData.summary);
    if (Array.isArray(resultData.items)) {
      resultData.items = resultData.items.map((item: any) => ({
        ...item,
        date: resolveRelativeDate(item.date, resultData.date || todayStr, `${item.name || ''} ${item.notes || ''}`),
      }));
    }
  }

  return resultData;
}

// Unified Service Call: Financial Advice
export async function getFinancialAdviceWithAI(params: {
  transactions: any[];
  limits: any[];
  bills: any[];
}): Promise<any> {
  // 1. Try server endpoint first
  try {
    const response = await fetch("/api/financial-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.success && resData.advice) {
        return resData.advice;
      }
    }
  } catch {
    // Fallback to client call
  }

  // 2. Fallback to client-side direct call
  const clientKey = getStoredGeminiApiKey();
  if (!clientKey) {
    throw new Error(
      "Klucz GEMINI_API_KEY nie został skonfigurowany. Podaj klucz w konfiguracji, aby skorzystać z analizy AI."
    );
  }

  return await getAdviceDirectClient(clientKey, params);
}
