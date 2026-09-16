import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import webpush from "web-push";

dotenv.config();

const app = express();
const PORT = 3000;

// Web Push Configuration (VAPID)
const VAPID_FILE = path.join(process.cwd(), ".vapid-keys.json");
let vapidKeys: { publicKey: string; privateKey: string };

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };
} else if (fs.existsSync(VAPID_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
  } catch {
    vapidKeys = webpush.generateVAPIDKeys();
    try {
      fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    } catch {}
  }
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  } catch (e) {
    console.warn("Nie udało się zapisać .vapid-keys.json:", e);
  }
}

try {
  webpush.setVapidDetails(
    "mailto:kontakt@planer-budzetu.app",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (e) {
  console.warn("Błąd konfiguracji VAPID:", e);
}

// In-memory and persistent store for Web Push Subscriptions
interface StoredPushSubscription {
  subscription: webpush.PushSubscription;
  householdId: string;
  userId: string;
  userName: string;
  updatedAt: string;
}

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), ".push-subscriptions.json");
let pushSubscriptions: StoredPushSubscription[] = [];

function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      pushSubscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8"));
    } else {
      pushSubscriptions = [];
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2));
    }
  } catch (e) {
    pushSubscriptions = [];
  }
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions, null, 2));
  } catch (e) {
    console.warn("Błąd zapisu subskrypcji push:", e);
  }
}

loadSubscriptions();

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
    const { imageBase64, mimeType, currentDate } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Brak danych obrazu paragonu." });
    }

    const ai = getGenAI();

    // Reference dates for resolving relative time indicators (e.g., Apple Pay "Dziś", "Wczoraj", "Wtorek")
    const today = (typeof currentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(currentDate))
      ? currentDate
      : new Date().toISOString().split("T")[0];

    const todayDateObj = new Date(today + "T12:00:00");
    const daysOfWeekPl = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const currentDayName = daysOfWeekPl[todayDateObj.getDay()] || "dzisiaj";

    const yesterdayDate = new Date(todayDateObj);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;

    const dayBeforeYesterdayDate = new Date(todayDateObj);
    dayBeforeYesterdayDate.setDate(dayBeforeYesterdayDate.getDate() - 2);
    const dayBeforeYesterdayStr = `${dayBeforeYesterdayDate.getFullYear()}-${String(dayBeforeYesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(dayBeforeYesterdayDate.getDate()).padStart(2, "0")}`;

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

    const prompt = `Jesteś precyzyjnym systemem OCR i asystentem finansowym do analizy paragonów fiskalnych, faktur VAT, wyciągów bankowych oraz zestawień PDF/zrzutów ekranu (w tym Apple Pay / Apple Wallet / kart płatniczych) w Polsce.

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
1. storeName: Nazwa sklepu / wystawcy faktury / banku / nadawcy / sprzedawcy / źródła (np. Apple Pay, Biedronka, Lidl, Uber, Castorama, Rossmann, PGNiG, Tauron, mBank itp.).
2. date: Główna data dokumentu lub data ostatniej operacji (w formacie YYYY-MM-DD). Jeśli niewidoczna, użyj bieżącej daty: ${today}.
3. totalAmount: Łączna kwota dokumentu lub suma transakcji (liczba w PLN, np. 149.99).
4. currency: Waluta (zwykle "PLN").
5. receiptNumber: Numer paragonu, faktury, konta, karty lub NIP (jeśli widoczny, inaczej pusty ciąg "").
6. dominantCategory: Dominująca kategoria całego dokumentu (wydatek lub wpływ).
7. summary: Krótkie podsumowanie w języku polskim (1-2 zdania), np. informacja o zrzucie Apple Pay, zakupach czy wyciągu z wpływami i wydatkami.
8. items: Lista pozycji zakupowych, operacji lub opłat z dokumentu.
Dla KAŻDEJ pozycji wyodrębnij:
- name: nazwa produktu/usługi lub opis operacji/płatności/przelewu
- type: 'expense' (jeśli to wydatek, zakup, opłata, obciążenie konta) LUB 'income' (jeśli to wpływ, wynagrodzenie, zwrot za towar/zakupy, wpłata gotówki, pożyczka/kredyt, świadczenie 800+, sprzedaż, uznanie konta)
- price: kwota za pozycję (zawsze dodatnia liczba w PLN, np. 5200.00 lub 89.40)
- quantity: ilość sztuk lub waga (liczba, domyślnie 1)
- category:
  * jeśli type='income', wybierz najbardziej pasującą kategorię z listy: ["Wypłata z etatu", "Premia / Bonus", "Gotówka", "Pożyczka / Kredyt", "Zwrot (zakupy, podatki)", "Freelance / Zlecenia", "Świadczenia / 800+", "Sprzedaż (Vinted, OLX)", "Prezent / Darowizna", "Odsetki / Inwestycje", "Alimenty", "Inne wpływy"]
  * jeśli type='expense', wybierz najbardziej pasującą kategorię z listy: ["Jedzenie i artykuły spożywcze", "Remont i dom", "Dla kotów i zwierząt", "Rachunki i media", "Zdrowie i kosmetyki", "Transport i paliwo", "Rozrywka i hobby", "Odzież i obuwie", "Edukacja i książki", "Inne wydatki"]
- date: dokładna data tej konkretnej pozycji w formacie YYYY-MM-DD. BARDZO WAŻNE: Na wyciągach bankowych, zestawieniach Apple Pay oraz PDF pozycje mogą mieć różne daty (np. część dziś, część wczoraj). Przypisz dla każdej pozycji jej faktyczną datę YYYY-MM-DD.
- notes: krótka notatka (np. opis, godzina płatności, metoda płatności jak Apple Pay, odbiorca/nadawca).

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

    // Sanitize dates and handle any relative strings that the model may have returned
    if (parsedData) {
      if (!parsedData.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsedData.date)) {
        parsedData.date = today;
      }
      if (Array.isArray(parsedData.items)) {
        parsedData.items = parsedData.items.map((item: any) => {
          let itemDate = item.date;
          if (!itemDate || !/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) {
            const context = `${itemDate || ''} ${item.name || ''} ${item.notes || ''}`.toLowerCase();
            if (/wczoraj|yesterday/.test(context)) {
              itemDate = yesterdayStr;
            } else if (/przedwczoraj/.test(context)) {
              itemDate = dayBeforeYesterdayStr;
            } else {
              itemDate = parsedData.date || today;
            }
          }
          return {
            ...item,
            date: itemDate,
          };
        });
      }
    }

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

// Web Push Endpoints
app.get("/api/push-vapid-public-key", (req, res) => {
  res.json({
    success: true,
    publicKey: vapidKeys.publicKey,
  });
});

app.post("/api/push-subscribe", (req, res) => {
  try {
    const { subscription, householdId, userId, userName } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: "Brak danych subskrypcji push." });
    }

    // Upsert subscription
    const existingIndex = pushSubscriptions.findIndex(
      (s) => s.subscription && s.subscription.endpoint === subscription.endpoint
    );

    const record: StoredPushSubscription = {
      subscription,
      householdId: householdId || "default",
      userId: userId || "",
      userName: userName || "Domownik",
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      pushSubscriptions[existingIndex] = record;
    } else {
      pushSubscriptions.push(record);
    }

    saveSubscriptions();
    return res.json({ success: true, message: "Subskrypcja zarejestrowana pomyślnie." });
  } catch (e: any) {
    console.error("Błąd zapisu subskrypcji push:", e);
    return res.status(500).json({ success: false, error: e?.message || "Błąd serwera." });
  }
});

app.post("/api/push-unsubscribe", (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      pushSubscriptions = pushSubscriptions.filter(
        (s) => s.subscription && s.subscription.endpoint !== endpoint
      );
      saveSubscriptions();
    }
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message });
  }
});

app.post("/api/send-push-notification", async (req, res) => {
  try {
    const {
      householdId,
      senderUserId,
      senderUserName,
      title,
      body,
      targetTab,
      extraSubscriptions,
      data,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: "Brak tytułu lub treści powiadomienia." });
    }

    // Merge server stored subscriptions with any client-supplied subscriptions (e.g. from Firestore document)
    const combinedMap = new Map<string, { subscription: webpush.PushSubscription; userId?: string }>();

    pushSubscriptions
      .filter((s) => !householdId || s.householdId === householdId)
      .forEach((s) => {
        if (s.subscription && s.subscription.endpoint) {
          combinedMap.set(s.subscription.endpoint, {
            subscription: s.subscription,
            userId: s.userId,
          });
        }
      });

    if (Array.isArray(extraSubscriptions)) {
      extraSubscriptions.forEach((s: any) => {
        const sub = s.subscription || s;
        if (sub && sub.endpoint && !combinedMap.has(sub.endpoint)) {
          combinedMap.set(sub.endpoint, {
            subscription: sub,
            userId: s.userId,
          });

          // Also persist into server's pushSubscriptions cache for automated bill checks
          const existingIdx = pushSubscriptions.findIndex(
            (p) => p.subscription && p.subscription.endpoint === sub.endpoint
          );
          const record: StoredPushSubscription = {
            subscription: sub,
            householdId: householdId || "default",
            userId: s.userId || "",
            userName: s.userName || "Domownik",
            updatedAt: new Date().toISOString(),
          };
          if (existingIdx >= 0) {
            pushSubscriptions[existingIdx] = record;
          } else {
            pushSubscriptions.push(record);
          }
        }
      });
      saveSubscriptions();
    }

    // Include all registered subscriptions in the household (self-notifications are enabled as requested by user)
    const targets = Array.from(combinedMap.values());

    const entityId = data?.entityId || data?.selectedTxId || data?.relatedId || "";
    let targetUrl = "/";
    if (targetTab === "transactions") {
      targetUrl = `/?tab=transactions${entityId ? `&txId=${encodeURIComponent(entityId)}` : ""}`;
    } else if (targetTab) {
      targetUrl = `/?tab=${encodeURIComponent(targetTab)}${entityId ? `&entityId=${encodeURIComponent(entityId)}` : ""}`;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: {
        url: targetUrl,
        targetTab: targetTab || "dashboard",
        entityId,
        selectedTxId: entityId,
        senderUserName: senderUserName || "Domownik",
        timestamp: Date.now(),
        ...data,
      },
    });

    let successCount = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      targets.map(async (target) => {
        try {
          const endpoint = target.subscription.endpoint || "";
          const isApple = endpoint.includes("push.apple.com");
          const pushOptions: any = {
            TTL: 86400,
            urgency: "high",
          };
          if (isApple) {
            pushOptions.headers = {
              "apns-push-type": "alert",
              "apns-priority": "10",
            };
          }

          await webpush.sendNotification(target.subscription, payload, pushOptions);
          successCount++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredEndpoints.push(target.subscription.endpoint);
          } else {
            console.warn("Błąd wysyłania push do odbiorcy:", err?.message || err);
          }
        }
      })
    );

    // Prune expired subscriptions if any
    if (expiredEndpoints.length > 0) {
      pushSubscriptions = pushSubscriptions.filter(
        (s) => !s.subscription || !expiredEndpoints.includes(s.subscription.endpoint)
      );
      saveSubscriptions();
    }

    return res.json({
      success: true,
      recipientsCount: targets.length,
      sentCount: successCount,
    });
  } catch (error: any) {
    console.error("Błąd send-push-notification:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Nie udało się rozesłać powiadomień push.",
    });
  }
});

// Test push directly to requesting device
app.post("/api/test-push-notification", async (req, res) => {
  try {
    const { subscription, title, body, userId, householdId, extraSubscriptions } = req.body;

    // Auto-upsert subscription if provided directly from requesting client
    if (subscription && subscription.endpoint) {
      const existingIdx = pushSubscriptions.findIndex(
        (s) => s.subscription && s.subscription.endpoint === subscription.endpoint
      );
      const record: StoredPushSubscription = {
        subscription,
        householdId: householdId || "default",
        userId: userId || "",
        userName: "Domownik (test)",
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        pushSubscriptions[existingIdx] = record;
      } else {
        pushSubscriptions.push(record);
      }
      saveSubscriptions();
    }

    const combinedMap = new Map<string, any>();
    if (subscription && subscription.endpoint) {
      combinedMap.set(subscription.endpoint, subscription);
    }

    if (Array.isArray(extraSubscriptions)) {
      extraSubscriptions.forEach((s: any) => {
        const sub = s.subscription || s;
        if (sub && sub.endpoint && !combinedMap.has(sub.endpoint)) {
          combinedMap.set(sub.endpoint, sub);
        }
      });
    }

    pushSubscriptions
      .filter((s) => (!userId || s.userId === userId) && (!householdId || s.householdId === householdId))
      .forEach((s) => {
        if (s.subscription && s.subscription.endpoint && !combinedMap.has(s.subscription.endpoint)) {
          combinedMap.set(s.subscription.endpoint, s.subscription);
        }
      });

    const targetSubs = Array.from(combinedMap.values());

    if (targetSubs.length === 0) {
      return res.status(400).json({
        success: false,
        sentCount: 0,
        error: "Brak aktywnej subskrypcji dla tego urządzenia. Kliknij 'Włącz powiadomienia w telefonie', aby zarejestrować to urządzenie.",
      });
    }

    const payload = JSON.stringify({
      title: title || "🔔 Test powiadomienia w telefonie",
      body: body || "Powiadomienia w tle działają prawidłowo!",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: {
        url: "/",
        timestamp: Date.now(),
      },
    });

    let sent = 0;
    let lastError: string | null = null;
    for (const sub of targetSubs) {
      try {
        const endpoint = sub.endpoint || "";
        const isApple = endpoint.includes("push.apple.com");
        const pushOptions: any = {
          TTL: 86400,
          urgency: "high",
        };
        if (isApple) {
          pushOptions.headers = {
            "apns-push-type": "alert",
            "apns-priority": "10",
          };
        }

        await webpush.sendNotification(sub, payload, pushOptions);
        sent++;
      } catch (e: any) {
        lastError = e?.message || String(e);
        console.warn("Błąd wysyłki test push:", e?.message || e, "statusCode:", e?.statusCode);
        // Clean up expired subscriptions
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          pushSubscriptions = pushSubscriptions.filter((s) => s.subscription?.endpoint !== sub.endpoint);
          saveSubscriptions();
        }
      }
    }

    if (sent === 0 && targetSubs.length > 0) {
      return res.status(502).json({
        success: false,
        sentCount: 0,
        error: lastError ? `Błąd dostarczenia powiadomienia: ${lastError}` : "Powiadomienie zostało odrzucone przez usługę push dostawcy (Google/Apple).",
      });
    }

    return res.json({
      success: true,
      sentCount: sent,
      message: `Powiadomienie testowe wysłano pomyślnie (${sent} urządzeń)!`,
    });
  } catch (e: any) {
    console.error("Błąd test-push-notification:", e);
    return res.status(500).json({ success: false, sentCount: 0, error: e?.message || "Błąd wysyłki testowej." });
  }
});

// Zaplanowane powiadomienie testowe z opóźnieniem (np. za 10s), aby użytkownik mógł zamknąć aplikację / zablokować telefon
app.post("/api/schedule-test-push", async (req, res) => {
  try {
    const { subscription, title, body, userId, householdId, extraSubscriptions, delaySeconds = 10 } = req.body;

    if (subscription && subscription.endpoint) {
      const existingIdx = pushSubscriptions.findIndex(
        (s) => s.subscription && s.subscription.endpoint === subscription.endpoint
      );
      const record: StoredPushSubscription = {
        subscription,
        householdId: householdId || "default",
        userId: userId || "",
        userName: "Domownik (test w tle)",
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        pushSubscriptions[existingIdx] = record;
      } else {
        pushSubscriptions.push(record);
      }
      saveSubscriptions();
    }

    const targetSubs: any[] = [];
    if (subscription && subscription.endpoint) {
      targetSubs.push(subscription);
    } else {
      pushSubscriptions
        .filter((s) => (!userId || s.userId === userId) && (!householdId || s.householdId === householdId))
        .forEach((s) => {
          if (s.subscription && !targetSubs.some((ts) => ts.endpoint === s.subscription.endpoint)) {
            targetSubs.push(s.subscription);
          }
        });
    }

    if (Array.isArray(extraSubscriptions)) {
      extraSubscriptions.forEach((s: any) => {
        const sub = s.subscription || s;
        if (sub && sub.endpoint && !targetSubs.some((ts) => ts.endpoint === sub.endpoint)) {
          targetSubs.push(sub);
        }
      });
    }

    if (targetSubs.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Brak zarejestrowanego urządzenia do testu w tle. Najpierw zezwól na powiadomienia na tym urządzeniu.",
      });
    }

    const effectiveDelay = Math.min(60, Math.max(3, Number(delaySeconds) || 10));

    // Wait during active HTTP request so Cloud Run container CPU stays 100% active
    await new Promise((resolve) => setTimeout(resolve, effectiveDelay * 1000));

    const payload = JSON.stringify({
      title: title || "🔔 Test w tle: Sukces!",
      body: body || "Powiadomienie dotarło przy wyłączonej aplikacji i zablokowanym telefonie! System działa w 100% w tle.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: {
        url: "/",
        targetTab: "dashboard",
        timestamp: Date.now(),
      },
    });

    let sentCount = 0;
    for (const sub of targetSubs) {
      try {
        const endpoint = sub.endpoint || "";
        const isApple = endpoint.includes("push.apple.com");
        const pushOptions: any = {
          TTL: 86400,
          urgency: "high",
        };
        if (isApple) {
          pushOptions.headers = {
            "apns-push-type": "alert",
            "apns-priority": "10",
          };
        }
        await webpush.sendNotification(sub, payload, pushOptions);
        sentCount++;
      } catch (e: any) {
        console.warn("Błąd dostarczenia zaplanowanego testu push:", e?.message);
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          pushSubscriptions = pushSubscriptions.filter((s) => s.subscription?.endpoint !== sub.endpoint);
          saveSubscriptions();
        }
      }
    }

    return res.json({
      success: true,
      delaySeconds: effectiveDelay,
      sentCount,
      message: `Powiadomienie w tle wysłane po ${effectiveDelay} sekundach!`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Błąd planowania push." });
  }
});

// Synchronizacja rachunków do monitorowania w tle przez serwer
const BILLS_CACHE_FILE = path.join(process.cwd(), ".household-bills-cache.json");
const NOTIFIED_BILLS_FILE = path.join(process.cwd(), ".notified-bills.json");

let householdBillsMap: Record<string, any[]> = {};
let notifiedBillsTracker: Record<string, string> = {};

try {
  if (fs.existsSync(BILLS_CACHE_FILE)) {
    householdBillsMap = JSON.parse(fs.readFileSync(BILLS_CACHE_FILE, "utf-8"));
  }
} catch {}

try {
  if (fs.existsSync(NOTIFIED_BILLS_FILE)) {
    notifiedBillsTracker = JSON.parse(fs.readFileSync(NOTIFIED_BILLS_FILE, "utf-8"));
  }
} catch {}

function saveHouseholdBillsCache() {
  try {
    fs.writeFileSync(BILLS_CACHE_FILE, JSON.stringify(householdBillsMap, null, 2), "utf-8");
  } catch {}
}

function saveNotifiedBillsTracker() {
  try {
    fs.writeFileSync(NOTIFIED_BILLS_FILE, JSON.stringify(notifiedBillsTracker, null, 2), "utf-8");
  } catch {}
}

app.post("/api/sync-household-bills", (req, res) => {
  try {
    const { householdId, bills } = req.body;
    if (!householdId || !Array.isArray(bills)) {
      return res.status(400).json({ success: false, error: "Brak householdId lub bills." });
    }
    householdBillsMap[householdId] = bills;
    saveHouseholdBillsCache();
    checkUpcomingBillsBackground(householdId).catch(() => {});
    return res.json({ success: true, count: bills.length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message });
  }
});

async function checkUpcomingBillsBackground(filterHouseholdId?: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();

  const householdsToCheck = filterHouseholdId
    ? [filterHouseholdId]
    : Object.keys(householdBillsMap);

  for (const hId of householdsToCheck) {
    const bills = householdBillsMap[hId] || [];
    const targets = pushSubscriptions.filter((s) => s.householdId === hId && s.subscription);
    if (targets.length === 0) continue;

    for (const bill of bills) {
      if (bill.status === "paid") continue;
      if (!bill.dueDate) continue;

      const due = new Date(bill.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 2 && diffDays >= -14) {
        const notifyKey = `${hId}:${bill.id}:${todayStr}:${diffDays <= 0 ? 'due_today' : 'upcoming'}`;
        if (notifiedBillsTracker[notifyKey]) {
          continue;
        }

        let title = "🔔 Rachunek do zapłacenia";
        let body = `${bill.name}: ${Number(bill.amount || 0).toFixed(2)} zł`;
        if (diffDays === 0) {
          title = "⚠️ Rachunek płatny DZISIAJ!";
          body = `${bill.name} (${Number(bill.amount || 0).toFixed(2)} zł) - termin mija dzisiaj!`;
        } else if (diffDays === 1) {
          title = "⏰ Rachunek płatny jutro";
          body = `${bill.name} (${Number(bill.amount || 0).toFixed(2)} zł) - termin: jutro (${bill.dueDate}).`;
        } else if (diffDays === 2) {
          title = "📅 Zbliża się termin rachunku (za 2 dni)";
          body = `${bill.name} (${Number(bill.amount || 0).toFixed(2)} zł) - płatność do ${bill.dueDate}.`;
        } else if (diffDays < 0) {
          title = "🚨 Zaległy rachunek do zapłacenia!";
          body = `${bill.name} (${Number(bill.amount || 0).toFixed(2)} zł) - termin minął: ${bill.dueDate}.`;
        }

        const payload = JSON.stringify({
          title,
          body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          data: {
            url: "/?tab=bills",
            targetTab: "bills",
            billId: bill.id,
            timestamp: Date.now(),
          },
        });

        for (const target of targets) {
          try {
            const isApple = target.subscription.endpoint?.includes("push.apple.com");
            const pushOpts: any = {
              TTL: 86400,
              urgency: "high",
            };
            if (isApple) {
              pushOpts.headers = {
                "apns-push-type": "alert",
                "apns-priority": "10",
              };
            }
            await webpush.sendNotification(target.subscription, payload, pushOpts);
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              pushSubscriptions = pushSubscriptions.filter((s) => s.subscription?.endpoint !== target.subscription.endpoint);
              saveSubscriptions();
            }
          }
        }

        notifiedBillsTracker[notifyKey] = new Date().toISOString();
        saveNotifiedBillsTracker();
      }
    }
  }
}

// Sprawdzanie rachunków w tle co 30 minut
setInterval(() => {
  checkUpcomingBillsBackground().catch((e) => console.warn("Błąd okresowego sprawdzania rachunków:", e?.message));
}, 30 * 60 * 1000);

// Serve Service Worker with required headers
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const swPath = path.join(process.cwd(), "public", "sw.js");
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.status(404).send("// Service worker file not found");
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
