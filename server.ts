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

// Initialize Google Gemini AI SDK with required User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Receipt Scanning Endpoint with Gemini Vision AI
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Brak danych obrazu paragonu." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Klucz GEMINI_API_KEY nie został skonfigurowany w środowisku.",
      });
    }

    // Clean base64 data if data-uri prefix is included
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "");
    const mediaType = mimeType || "image/jpeg";

    const prompt = `Jesteś ekspertem finansowym i precyzyjnym systemem OCR do analizy paragonów fiskalnych i faktur w Polsce.
Przeanalizuj dołączone zdjęcie paragonu i wyodrębnij:
1. Nazwa sklepu / sprzedawcy (np. Biedronka, Lidl, Castorama, Maxi Zoo, PGNiG, itp.).
2. Data transakcji (w formacie YYYY-MM-DD). Jeśli brak, użyj bieżącej daty.
3. Łączna kwota do zapłaty (totalAmount w PLN jako liczba).
4. Numer paragonu / NIP (jeśli widoczny, inaczej puste).
5. Waluta (zwykle PLN).
6. Lista pozycji zakupowych (items) - dla każdej pozycji:
   - name: pełna nazwa produktu lub usługi
   - price: cena całkowita za daną pozycję (liczba)
   - quantity: ilość (opcjonalnie, domyślnie 1)
   - category: przypisana kategoria wydatku z listy: ["Jedzenie i artykuły spożywcze", "Remont i dom", "Dla zwierząt i kotów", "Rachunki i media", "Zdrowie i kosmetyki", "Transport i paliwo", "Rozrywka i hobby", "Odzież i obuwie", "Inne"]
   - notes: dodatkowa uwaga, np. "karma dla kota", "mleko", "farba"
7. Dominująca kategoria całego paragonu (dominantCategory).
8. Krótkie podsumowanie w języku polskim (summary, 1-2 zdania).

Zwróć wynik ściśle w formacie JSON zgodnym ze schematem.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mediaType,
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
            storeName: { type: Type.STRING, description: "Nazwa sklepu lub wystawcy paragonu" },
            date: { type: Type.STRING, description: "Data w formacie YYYY-MM-DD" },
            totalAmount: { type: Type.NUMBER, description: "Suma paragonu w PLN" },
            currency: { type: Type.STRING, description: "Waluta, np. PLN" },
            receiptNumber: { type: Type.STRING, description: "Numer paragonu" },
            dominantCategory: { type: Type.STRING, description: "Główna kategoria wydatku" },
            summary: { type: Type.STRING, description: "Krótkie podsumowanie paragonu" },
            items: {
              type: Type.ARRAY,
              description: "Pozycje na paragonie",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nazwa produktu lub usługi" },
                  price: { type: Type.NUMBER, description: "Kwota za pozycję" },
                  quantity: { type: Type.NUMBER, description: "Ilość sztuk lub waga" },
                  category: { type: Type.STRING, description: "Kategoria wydatku" },
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

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText);

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
    const { monthlyIncome, totalExpenses, categoryBreakdown, budgetLimits, bills } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Brak klucza API Gemini." });
    }

    const prompt = `Jesteś życzliwym, mądrym i pragmatycznym doradcą budżetu domowego.
Przeanalizuj bieżący stan finansów użytkownika:
- Łączne dochody w tym miesiącu: ${monthlyIncome} PLN
- Łączne wydatki w tym miesiącu: ${totalExpenses} PLN
- Podział wydatków na kategorie: ${JSON.stringify(categoryBreakdown || [])}
- Ustawione limity budżetowe: ${JSON.stringify(budgetLimits || [])}
- Zbliżające się rachunki domowe: ${JSON.stringify(bills || [])}

Przygotuj zwięzłą, konkretną analizę w języku polskim:
1. Ocena bieżącej kondycji finansowej (bilans, wskaźnik oszczędności).
2. Kategorie, w których przekroczono budżet lub zbliżają się do limitu.
3. 3 konkretne, praktyczne wskazówki jak zaoszczędzić (np. na rachunkach domowych, zakupach jedzeniowych, zwierzakach lub remontach).
4. Podsumowanie jednym motywującym zdaniem.

Zwróć odpowiedź w formacie JSON ze schematem:
{
  "financialHealth": "Doskonała" | "Dobra" | "Umiarkowana" | "Wymaga uwagi",
  "savingsRatePercent": number,
  "alerts": string[],
  "actionableTips": string[],
  "summary": string
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
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
          },
          required: ["financialHealth", "savingsRatePercent", "alerts", "actionableTips", "summary"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
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
