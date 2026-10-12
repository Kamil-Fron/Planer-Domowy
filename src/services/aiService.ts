import { compressImageBase64, extractRawBase64 } from "../utils/imageCompressor";
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

async function scanReceiptDirectClient(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  referenceDate?: string,
  options?: ScanReceiptOptions
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

  // Clean raw base64 (ensure no data: prefix, no whitespace)
  const cleanBase64 = extractRawBase64(imageBase64);
  const detectedMime = isPdf ? 'application/pdf' : (mimeType || 'image/jpeg');

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
}
`;

  // Dwa modele rozbite na 28 sekund zgodnie z wytycznymi:
  // Model 1: gemini-3.1-flash-lite (10 sekund)
  // Model 2: gemini-3.8-flash (pozostałe 18 sekund)
  const modelConfigs = [
    { name: "gemini-3.1-flash-lite", timeoutMs: 10000, label: "gemini-3.1-flash-lite (szybki)" },
    { name: "gemini-3.8-flash", timeoutMs: 18000, label: "gemini-3.8-flash (główny)" },
  ];
  let lastError: any = null;
  let allQuotaExhausted = true;
  let allHighDemand = true;

  for (let i = 0; i < modelConfigs.length; i++) {
    const config = modelConfigs[i];
    const model = config.name;
    const timeoutMs = config.timeoutMs;
    const timeoutSec = Math.round(timeoutMs / 1000);

    if (options?.signal?.aborted) {
      throw new Error("Skanowanie zostało anulowane przez użytkownika.");
    }

    options?.onProgress?.(`Analiza przez model ${model} (krok ${i + 1}/2, limit ${timeoutSec}s)...`);

    // Dedykowany timeout: 10s dla pierwszego modelu, 18s dla modelu gemini-3.8-flash
    const attemptController = new AbortController();
    const attemptTimeout = setTimeout(() => attemptController.abort(), timeoutMs);

    const onParentAbort = () => attemptController.abort();
    if (options?.signal) {
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

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
        signal: attemptController.signal,
      });

      clearTimeout(attemptTimeout);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawErrMsg = errJson?.error?.message || "";

        // Wykryj nieprawidłowy klucz API wcześnie i zgłoś jasny komunikat
        if (res.status === 400 || res.status === 403) {
          if (/API key not valid|INVALID_ARGUMENT|PERMISSION_DENIED|API_KEY_INVALID/i.test(rawErrMsg)) {
            throw new Error(
              "Wprowadzony klucz Gemini API jest nieprawidłowy lub nieaktywny. Kliknij 'Skonfiguruj Gemini API' i podaj poprawny klucz z Google AI Studio (aistudio.google.com/app/apikey)."
            );
          }
        }

        // Błąd wyczerpania limitu (429) -> przełącz na kolejny model
        if (res.status === 429) {
          console.info(`Model ${model} osiągnął limit zapytań (429), przełączam na kolejny model...`);
          lastError = new Error(`Przekroczono limit darmowych zapytań dla modelu ${model} (błąd 429).`);
          continue;
        }

        // Błąd przeciążenia serwerów Google (503 / High Demand) -> przełącz na kolejny model
        const isHighDemand =
          res.status === 503 ||
          res.status === 500 ||
          res.status === 502 ||
          res.status === 504 ||
          /high demand|overloaded|spikes in demand|temporary|unavailable/i.test(rawErrMsg);

        if (isHighDemand) {
          allQuotaExhausted = false;
          console.info(`Model ${model} chwilowo przeciążony przez Google (503 High Demand), przełączam na kolejny model...`);
          lastError = new Error(
            `Model ${model} jest chwilowo przeciążony przez serwery Google (High Demand).`
          );
          continue;
        }

        allQuotaExhausted = false;
        allHighDemand = false;
        lastError = new Error(rawErrMsg || `Błąd Gemini API (${res.status} ${res.statusText})`);
        continue;
      }

      allQuotaExhausted = false;
      allHighDemand = false;
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
      clearTimeout(attemptTimeout);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }

      if (options?.signal?.aborted) {
        throw new Error("Skanowanie zostało anulowane przez użytkownika.");
      }

      if (err?.message?.includes("Wprowadzony klucz Gemini API jest nieprawidłowy")) {
        throw err;
      }

      if (err?.name === "AbortError") {
        allQuotaExhausted = false;
        allHighDemand = false;
        console.info(`Model ${model} przekroczył limit czasu (${timeoutSec}s), przełączanie na kolejny model...`);
        lastError = new Error(`Przekroczono limit czasu oczekiwania na model ${model} (${timeoutSec}s).`);
      } else {
        if (!err?.message?.includes("429")) {
          allQuotaExhausted = false;
        }
        if (!/high demand|overloaded|spikes/i.test(err?.message || '')) {
          allHighDemand = false;
        }
        console.info(`Model ${model} niedostępny, sprawdzam kolejny model...`, err?.message || err);
        lastError = err;
      }
    }
  }

  if (allQuotaExhausted && lastError) {
    throw new Error(
      "Darmowy limit zapytań Gemini API został wyczerpany (błąd 429 Quota Exceeded). Google odnawia darmowy limit codziennie. Możesz również utworzyć nowy bezpłatny klucz API w Google AI Studio (aistudio.google.com/app/apikey) i wkleić go w ustawieniach skanera."
    );
  }

  if (allHighDemand && lastError) {
    throw new Error(
      "Serwery Google Gemini są w tej chwili mocno obciążone ('This model is currently experiencing high demand'). Zwykle przeciążenie ustępuje po chwili. Odczekaj moment i kliknij 'Spróbuj ponownie'."
    );
  }

  if (lastError?.message && /high demand|spikes in demand/i.test(lastError.message)) {
    throw new Error(
      "Serwery Google Gemini są w tej chwili mocno obciążone ('High demand'). Odczekaj chwilę i kliknij 'Spróbuj ponownie'."
    );
  }

  throw lastError || new Error("Nie udało się przeanalizować paragonu przez Gemini API. Sprawdź jakość zdjęcia lub połączenie z internetem.");
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

  const models = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
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
        if (res.status === 503 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 600));
        }
        throw new Error(errJson?.error?.message || `Błąd API (${res.status})`);
      }

      const resultData = await res.json();
      return extractJson(resultData);
    } catch (err: any) {
      console.info(`Model ${model} niedostępny, sprawdzam alternatywny...`);
      lastError = err;
    }
  }

  throw lastError || new Error("Nie udało się wygenerować analizy finansowej.");
}

export interface ScanReceiptOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (stage: string) => void;
}

export function isStaticDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith("github.io") ||
    host.endsWith("pages.dev") ||
    host.endsWith("github.dev") ||
    host.includes("netlify.app") ||
    host.includes("vercel.app") ||
    host.includes("firebaseapp.com") ||
    host.includes("web.app") ||
    window.location.protocol === "file:"
  );
}

// Unified Service Call: Scan Receipt
export async function scanReceiptWithAI(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  referenceDate?: string,
  options?: ScanReceiptOptions
): Promise<any> {
  // Auto-detect PDF from base64 if needed
  let effectiveMime = mimeType;
  if (imageBase64.startsWith("data:application/pdf") || mimeType === "application/pdf") {
    effectiveMime = "application/pdf";
  }

  options?.onProgress?.("Optymalizacja i kompresja zdjęcia...");

  // Pre-compress high-resolution camera photos to ~150-250KB to prevent network timeouts and payload limits
  let cleanBase64ToSend = extractRawBase64(imageBase64);
  if (!effectiveMime.includes("pdf") && !imageBase64.startsWith("data:application/pdf")) {
    try {
      const comp = await compressImageBase64(imageBase64, 1400, 1400, 0.8);
      cleanBase64ToSend = comp.base64;
      effectiveMime = comp.mimeType || "image/jpeg";
    } catch (e) {
      console.warn("Kompresja obrazu przed wysyłką:", e);
      cleanBase64ToSend = extractRawBase64(imageBase64);
    }
  }

  const todayStr = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : toLocalISODate(new Date());

  let resultData: any = null;
  const isStatic = isStaticDeployment();

  // 1. Try server endpoint ONLY when NOT on static deployment (e.g. Node / Express backend in AI Studio / Cloud Run)
  if (!isStatic) {
    options?.onProgress?.("Przetwarzanie przez serwer AI...");
    try {
      const serverController = new AbortController();
      const serverTimeout = setTimeout(() => serverController.abort(), 7000); // 7s fast timeout
      const onAbort = () => serverController.abort();
      if (options?.signal) {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: cleanBase64ToSend, mimeType: effectiveMime, currentDate: todayStr }),
        signal: serverController.signal,
      });

      clearTimeout(serverTimeout);
      if (options?.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          resultData = resData.data;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const serverErrMsg = errData?.error || `Błąd serwera (${response.status})`;
        if (!getStoredGeminiApiKey()) {
          throw new Error(serverErrMsg);
        }
      }
    } catch (e: any) {
      if (options?.signal?.aborted) {
        throw new Error("Skanowanie zostało anulowane przez użytkownika.");
      }
      if (!getStoredGeminiApiKey() && e?.message && !e.message.includes("fetch") && !e.message.includes("AbortError")) {
        throw e;
      }
      // If server failed and client key exists, fall through to client call
    }
  }

  // 2. Direct client call (GitHub Pages or fallback)
  if (!resultData) {
    if (options?.signal?.aborted) {
      throw new Error("Skanowanie zostało anulowane przez użytkownika.");
    }

    const clientKey = getStoredGeminiApiKey();
    if (!clientKey) {
      if (isStatic) {
        throw new Error(
          "W wersji GitHub Pages wymagany jest klucz Gemini API. Kliknij przycisk 'Skonfiguruj Gemini API' u góry i wprowadź swój bezpłatny klucz z Google AI Studio (aistudio.google.com/app/apikey)."
        );
      }
      throw new Error(
        "Klucz GEMINI_API_KEY nie został skonfigurowany. Kliknij przycisk 'Skonfiguruj Gemini API' i podaj swój klucz z Google AI Studio."
      );
    }

    options?.onProgress?.("Wysyłanie do Gemini API z przeglądarki...");
    resultData = await scanReceiptDirectClient(clientKey, cleanBase64ToSend, effectiveMime, todayStr, options);
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
    } else {
      const errData = await response.json().catch(() => ({}));
      if (errData?.error && !getStoredGeminiApiKey()) {
        throw new Error(errData.error);
      }
    }
  } catch (e: any) {
    if (!getStoredGeminiApiKey() && e?.message && !e.message.includes("fetch")) {
      throw e;
    }
    // Fallback to client call if key is present
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
