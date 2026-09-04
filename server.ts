import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 receipt images
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Dynamic initialization of Gemini client (never caches an empty key)
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "Klucz GEMINI_API_KEY nie został skonfigurowany w środowisku. Aby korzystać z funkcji AI (skaner paragonów i doradca), dodaj poprawny klucz GEMINI_API_KEY w panelu Settings -> Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient fallback across model aliases
async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const modelsToTry = [
    params.preferredModel || "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });
      if (result && (result.text || (result as any).candidates)) {
        return result;
      }
    } catch (err: any) {
      console.warn(`Próba modelu ${modelName} nie powiodła się:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("Wszystkie próby połączenia z modelami Gemini zakończyły się niepowodzeniem.");
}

// Clean JSON extraction from AI response
function extractJsonFromText(rawText: string | undefined): any {
  if (!rawText) throw new Error("Model AI zwrócił pustą treść.");
  let cleaned = rawText.trim();
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

// API Routes
app.get("/api/health", (req, res) => {
  const rawKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(rawKey && rawKey.trim() !== "" && rawKey !== "MY_GEMINI_API_KEY");
  res.json({
    status: "ok",
    hasApiKey: isConfigured,
    message: isConfigured
      ? "Klucz GEMINI_API_KEY jest poprawnie skonfigurowany."
      : "Brak klucza GEMINI_API_KEY w zmiennych środowiskowych.",
    timestamp: new Date().toISOString(),
  });
});

// Receipt Scanning Endpoint with Gemini Vision AI
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Brak danych obrazu paragonu." });
    }

    const ai = getGenAI();

    // Extract exact mime-type if embedded in data-uri or provided
    let detectedMime = mimeType || "image/jpeg";
    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+);base64,/i);
    if (mimeMatch) {
      detectedMime = mimeMatch[1];
    } else if (mimeType) {
      detectedMime = mimeType;
    }

    // Clean base64 data
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, "").trim();

    const prompt = `Jesteś precyzyjnym systemem OCR i asystentem finansowym do analizy paragonów fiskalnych, faktur VAT, wyciągów bankowych oraz zestawień PDF/zdjęć w Polsce.
Przeanalizuj dołączony dokument (paragon, fakturę, wyciąg bankowy lub plik PDF) i wyodrębnij:
1. storeName: Nazwa sklepu / wystawcy faktury / banku / nadawcy / sprzedawcy (np. Biedronka, Lidl, Castorama, Rossmann, PGNiG, Tauron, mBank itp.).
2. date: Główna data dokumentu lub data ostatniej operacji (w formacie YYYY-MM-DD). Jeśli niewidoczna, użyj bieżącej daty.
3. totalAmount: Łączna kwota dokumentu lub suma transakcji (liczba w PLN, np. 149.99).
4. currency: Waluta (zwykle "PLN").
5. receiptNumber: Numer paragonu, faktury, konta lub NIP (jeśli widoczny, inaczej pusty ciąg "").
6. dominantCategory: Dominująca kategoria całego dokumentu (wydatek lub wpływ).
7. summary: Krótkie podsumowanie w języku polskim (1-2 zdania), np. informacja czy dokument zawiera zakupy, rachunki czy wyciąg z wpływami i wydatkami.
8. items: Lista pozycji zakupowych, operacji lub opłat z dokumentu.
Dla KAŻDEJ pozycji wyodrębnij:
- name: nazwa produktu/usługi lub opis operacji/przelewu
- type: 'expense' (jeśli to wydatek, zakup, opłata, obciążenie konta) LUB 'income' (jeśli to wpływ, wynagrodzenie, zwrot za towar/zakupy, wpłata gotówki, pożyczka/kredyt, świadczenie 800+, sprzedaż, uznanie konta)
- price: kwota za pozycję (zawsze dodatnia liczba w PLN, np. 5200.00 lub 89.40)
- quantity: ilość sztuk lub waga (liczba, domyślnie 1)
- category:
  * jeśli type='income', wybierz najbardziej pasującą kategorię z listy: ["Wypłata z etatu", "Premia / Bonus", "Gotówka", "Pożyczka / Kredyt", "Zwrot (zakupy, podatki)", "Freelance / Zlecenia", "Świadczenia / 800+", "Sprzedaż (Vinted, OLX)", "Prezent / Darowizna", "Odsetki / Inwestycje", "Alimenty", "Inne wpływy"]
  * jeśli type='expense', wybierz najbardziej pasującą kategorię z listy: ["Jedzenie i artykuły spożywcze", "Remont i dom", "Dla kotów i zwierząt", "Rachunki i media", "Zdrowie i kosmetyki", "Transport i paliwo", "Rozrywka i hobby", "Odzież i obuwie", "Edukacja i książki", "Inne wydatki"]
- date: dokładna data tej konkretnej pozycji w formacie YYYY-MM-DD. BARDZO WAŻNE: Na wyciągach bankowych, zestawieniach PDF lub zbiorczych dokumentach pozycje mogą mieć różne daty operacji/księgowania. Jeśli dana pozycja ma własną datę w dokumencie, podaj ją tutaj; jeśli to pojedynczy paragon z jedną datą, podaj datę tego paragonu.
- notes: krótka notatka (np. opis, metoda płatności, odbiorca/nadawca przelewu).

Zwróć wynik w formacie JSON zgodnym ze schematem.`;

    const response = await generateWithFallback(ai, {
      preferredModel: "gemini-3.6-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: detectedMime,
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            storeName: { type: Type.STRING, description: "Nazwa sklepu lub wystawcy paragonu/dokumentu" },
            date: { type: Type.STRING, description: "Główna data dokumentu w formacie YYYY-MM-DD" },
            totalAmount: { type: Type.NUMBER, description: "Suma dokumentu w PLN" },
            currency: { type: Type.STRING, description: "Waluta, np. PLN" },
            receiptNumber: { type: Type.STRING, description: "Numer paragonu/faktury/rachunku" },
            dominantCategory: { type: Type.STRING, description: "Główna kategoria wydatku lub wpływu" },
            summary: { type: Type.STRING, description: "Krótkie podsumowanie dokumentu" },
            items: {
              type: Type.ARRAY,
              description: "Pozycje na paragonie lub wyciągu",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nazwa produktu, usługi lub operacji" },
                  type: { type: Type.STRING, description: "Typ operacji: 'expense' (wydatek) lub 'income' (wpływ/uznanie)" },
                  price: { type: Type.NUMBER, description: "Kwota za pozycję (dodatnia)" },
                  quantity: { type: Type.NUMBER, description: "Ilość sztuk lub waga" },
                  category: { type: Type.STRING, description: "Kategoria wydatku lub wpływu" },
                  date: { type: Type.STRING, description: "Indywidualna data danej pozycji w formacie YYYY-MM-DD (np. data operacji na wyciągu)" },
                  notes: { type: Type.STRING, description: "Krótka notatka" },
                },
                required: ["name", "price", "category"],
              },
            },
          },
          required: ["storeName", "totalAmount", "items", "dominantCategory"],
        },
      },
    });

    const parsedData = extractJsonFromText(response.text);

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Błąd podczas skanowania paragonu:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Wystąpił błąd podczas analizy paragonu przez model AI.",
    });
  }
});

// AI Financial Advisor Endpoint
app.post("/api/financial-advice", async (req, res) => {
  try {
    const {
      transactions = [],
      limits = [],
      bills = [],
      monthlyIncome,
      totalExpenses,
      categoryBreakdown,
      budgetLimits,
    } = req.body;

    const ai = getGenAI();

    // Derive metrics if not explicitly passed
    let income = typeof monthlyIncome === "number" ? monthlyIncome : 0;
    let expenses = typeof totalExpenses === "number" ? totalExpenses : 0;
    let categories = Array.isArray(categoryBreakdown) ? categoryBreakdown : [];

    if (Array.isArray(transactions) && transactions.length > 0) {
      if (typeof monthlyIncome !== "number") {
        income = transactions
          .filter((t: any) => t.type === "income")
          .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      }
      if (typeof totalExpenses !== "number") {
        expenses = transactions
          .filter((t: any) => t.type === "expense")
          .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      }
      if (categories.length === 0) {
        const catMap: Record<string, number> = {};
        transactions
          .filter((t: any) => t.type === "expense")
          .forEach((t: any) => {
            const cat = t.category || "Inne";
            catMap[cat] = (catMap[cat] || 0) + (Number(t.amount) || 0);
          });
        categories = Object.entries(catMap).map(([cat, sum]) => ({ category: cat, amount: sum }));
      }
    }

    const effectiveLimits = budgetLimits || limits || [];
    const effectiveBills = bills || [];

    const prompt = `Jesteś życzliwym, mądrym i pragmatycznym doradcą budżetu domowego.
Przeanalizuj bieżący stan finansów użytkownika:
- Łączne dochody w tym miesiącu: ${income.toFixed(2)} PLN
- Łączne wydatki w tym miesiącu: ${expenses.toFixed(2)} PLN
- Bilans netto: ${(income - expenses).toFixed(2)} PLN
- Podział wydatków na kategorie: ${JSON.stringify(categories)}
- Ustawione limity budżetowe: ${JSON.stringify(effectiveLimits)}
- Zbliżające się rachunki domowe: ${JSON.stringify(effectiveBills)}

Przygotuj zwięzłą, konkretną analizę w języku polskim:
1. financialHealth: Ocena bieżącej kondycji finansowej ("Doskonała" | "Dobra" | "Umiarkowana" | "Wymaga uwagi").
2. savingsRatePercent: Szacowany wskaźnik oszczędności jako liczba procentowa (np. 20).
3. alerts: 1-3 alerty dotyczące przekroczeń budżetu, zbliżających się opłat lub ryzyk (tablica stringów).
4. actionableTips: 3 konkretne, praktyczne wskazówki jak zaoszczędzić (np. na rachunkach domowych, zakupach jedzeniowych, zwierzakach lub remontach).
5. summary: Podsumowanie jednym motywującym, profesjonalnym zdaniem.
6. fullText: Całościowy czytelny tekst analizy w punktach (po polsku) gotowy do natychmiastowego wyświetlenia.

Zwróć odpowiedź ściśle w formacie JSON zgodnym ze schematem.`;

    const response = await generateWithFallback(ai, {
      preferredModel: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            financialHealth: { type: Type.STRING },
            savingsRatePercent: { type: Type.NUMBER },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionableTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            fullText: { type: Type.STRING },
          },
          required: ["financialHealth", "savingsRatePercent", "alerts", "actionableTips", "summary"],
        },
      },
    });

    const parsed = extractJsonFromText(response.text);

    return res.json({ success: true, advice: parsed });
  } catch (error: any) {
    console.error("Błąd generowania porad finansowych:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Nie udało się wygenerować analizy finansowej.",
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
