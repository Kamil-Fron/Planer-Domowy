import { GoogleGenAI, Type } from "@google/genai";

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

  // 2. Check client-side injected key (from GitHub Actions secret or .env)
  const clientKey = getStoredGeminiApiKey();
  if (clientKey) {
    const isFromStorage = typeof window !== "undefined" && Boolean(localStorage.getItem("gemini_api_key"));
    return {
      isConfigured: true,
      source: isFromStorage ? "client_storage" : "client_env",
      message: "Połączono z Gemini AI (Klucz wdrożeniowy GitHub Pages)",
    };
  }

  return {
    isConfigured: false,
    source: "none",
    message: "Brak skonfigurowanego klucza GEMINI_API_KEY",
  };
}

// Clean JSON extraction from AI response string
function extractJson(text: string | undefined): any {
  if (!text) throw new Error("Model AI zwrócił pustą treść.");
  let cleaned = text.trim();
  if (cleaned.includes("```")) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
  }
  return JSON.parse(cleaned);
}

// Direct Client-Side Gemini Vision Scan (works directly on GitHub Pages without server)
async function scanReceiptDirectClient(
  apiKey: string,
  imageBase64: string,
  mimeType: string
): Promise<any> {
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, "").trim();
  let detectedMime = mimeType || "image/jpeg";
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/i);
  if (match) detectedMime = match[1];

  const prompt = `Jesteś precyzyjnym systemem OCR i asystentem finansowym do analizy paragonów fiskalnych i faktur w Polsce.
Przeanalizuj dołączone zdjęcie paragonu i wyodrębnij:
1. storeName: Nazwa sklepu / sprzedawcy (np. Biedronka, Lidl, Castorama, Rossmann, PGNiG, itp.).
2. date: Data transakcji (w formacie YYYY-MM-DD). Jeśli niewidoczna, użyj bieżącej daty.
3. totalAmount: Łączna kwota do zapłaty (liczba w PLN).
4. currency: Waluta (zwykle "PLN").
5. receiptNumber: Numer paragonu lub NIP (jeśli widoczny, inaczej pusty ciąg "").
6. dominantCategory: Dominująca kategoria całego paragonu spośród: ["Jedzenie i artykuły spożywcze", "Remont i dom", "Dla zwierząt i kotów", "Rachunki i media", "Zdrowie i kosmetyki", "Transport i paliwo", "Rozrywka i hobby", "Odzież i obuwie", "Inne"].
7. summary: Krótkie podsumowanie w języku polskim (1-2 zdania).
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

  // Try direct REST fetch first as it's 100% browser native with CORS support
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: detectedMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
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
        throw new Error(errJson?.error?.message || `Błąd API (${res.status} ${res.statusText})`);
      }

      const resultData = await res.json();
      const rawText = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
      return extractJson(rawText);
    } catch (err: any) {
      console.warn(`Próba z modelem ${model} nie powiodła się:`, err);
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

  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
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
      const rawText = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
      return extractJson(rawText);
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
      "Klucz GEMINI_API_KEY nie został skonfigurowany. Dodaj swój klucz w ustawieniach lub zmiennych środowiskowych GitHub Pages."
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
      "Klucz GEMINI_API_KEY nie został skonfigurowany. Dodaj swój klucz w ustawieniach lub zmiennych środowiskowych GitHub Pages."
    );
  }

  return await getAdviceDirectClient(clientKey, params);
}
