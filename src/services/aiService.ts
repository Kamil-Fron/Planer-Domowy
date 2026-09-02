import { compressImageBase64 } from "../utils/imageCompressor";

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
  mimeType: string
): Promise<any> {
  // Compress high-res mobile image to ensure fast transfer (<400KB) and crisp OCR
  const { base64: cleanBase64, mimeType: compressedMime } = await compressImageBase64(
    imageBase64,
    1600,
    1600,
    0.85
  );

  const prompt = `Jesteś precyzyjnym systemem OCR i asystentem finansowym do analizy paragonów fiskalnych i faktur w Polsce.
Przeanalizuj dołączone zdjęcie paragonu i wyodrębnij:
1. storeName: Nazwa sklepu / stacji paliw / sprzedawcy (np. Pieprzyk, Biedronka, Lidl, Orlen, Castorama, Rossmann itp.).
2. date: Data transakcji (w formacie YYYY-MM-DD). Jeśli niewidoczna, użyj bieżącej daty.
3. totalAmount: Łączna kwota do zapłaty (liczba w PLN, np. 111.31).
4. currency: Waluta (zwykle "PLN").
5. receiptNumber: Numer paragonu lub NIP (jeśli widoczny, inaczej "").
6. dominantCategory: Dominująca kategoria całego paragonu spośród: ["Transport i paliwo", "Jedzenie i artykuły spożywcze", "Remont i dom", "Dla zwierząt i kotów", "Rachunki i media", "Zdrowie i kosmetyki", "Rozrywka i hobby", "Odzież i obuwie", "Inne"].
7. summary: Krótkie podsumowanie w języku polskim (np. "Zakup paliwa na stacji Pieprzyk").
8. items: Lista pozycji zakupowych z paragonu (dla każdego produktu: name, price (liczba), quantity (liczba, domyślnie 1), category, notes).

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
      "price": 0.00,
      "quantity": 1,
      "category": "string",
      "notes": "string"
    }
  ]
}`;

  // Use currently supported, high-accuracy vision models
  const models = ["gemini-2.5-flash", "gemini-2.5-pro"];
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
                  mime_type: compressedMime || mimeType || "image/jpeg",
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
      return extractJson(resultData);
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

  const models = ["gemini-2.5-flash", "gemini-2.5-pro"];
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
export async function scanReceiptWithAI(imageBase64: string, mimeType: string = "image/jpeg"): Promise<any> {
  // 1. Try server endpoint first (Node / Express backend in AI Studio)
  try {
    const response = await fetch("/api/scan-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.success && resData.data) {
        return resData.data;
      }
    }
  } catch {
    // Ignore server error and fallback to direct client call
  }

  // 2. Fallback to client-side direct API call (e.g. GitHub Pages)
  const clientKey = getStoredGeminiApiKey();
  if (!clientKey) {
    throw new Error(
      "Klucz GEMINI_API_KEY nie został skonfigurowany. Kliknij przycisk 'Skonfiguruj Gemini API' i podaj swój klucz z Google AI Studio."
    );
  }

  return await scanReceiptDirectClient(clientKey, imageBase64, mimeType);
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
