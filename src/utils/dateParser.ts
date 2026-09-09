/**
 * Narzędzie do precyzyjnego parsowania i uzupełniania dat transakcji,
 * ze specjalną obsługą zrzutów ekranu i zestawień z Apple Pay, Portfela Apple,
 * wyciągów bankowych oraz relatywnych oznaczeń ("Dziś", "Wczoraj", "Poniedziałek", "3 dni temu").
 */

export function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const POLISH_MONTHS: Record<string, number> = {
  stycznia: 1, styczen: 1, sty: 1,
  lutego: 2, luty: 2, lut: 2,
  marca: 3, marzec: 3, mar: 3,
  kwietnia: 4, kwiecien: 4, kwi: 4,
  maja: 5, maj: 5,
  czerwca: 6, czerwiec: 6, cze: 6,
  lipca: 7, lipiec: 7, lip: 7,
  sierpnia: 8, sierpien: 8, sie: 8,
  wrzesnia: 9, wrzesien: 9, wrz: 9,
  pazdziernika: 10, pazdziernik: 10, paz: 10,
  listopada: 11, listopad: 11, lis: 11,
  grudnia: 12, grudzien: 12, gru: 12,
};

const WEEKDAYS_MAP: Record<string, number> = {
  // Niedziela = 0, Poniedziałek = 1, ..., Sobota = 6
  niedziela: 0, niedzieli: 0, niedz: 0, nd: 0, sunday: 0, sun: 0,
  poniedzialek: 1, poniedzialku: 1, pon: 1, pn: 1, monday: 1, mon: 1,
  wtorek: 2, wtorku: 2, wt: 2, tuesday: 2, tue: 2,
  sroda: 3, srody: 3, sr: 3, wednesday: 3, wed: 3,
  czwartek: 4, czwartku: 4, czw: 4, cz: 4, thursday: 4, thu: 4,
  piatek: 5, piatku: 5, pt: 5, friday: 5, fri: 5,
  sobota: 6, soboty: 6, sob: 6, sb: 6, saturday: 6, sat: 6,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Przelicza relatywną lub niepełną datę (np. "Dziś", "Wczoraj", "Poniedziałek", "14:20", "2 dni temu")
 * na pełny format kalendarzowy YYYY-MM-DD w oparciu o bieżącą datę referencyjną.
 */
export function resolveRelativeDate(
  rawDate?: string,
  referenceDateStr?: string,
  extraContext?: string
): string {
  const baseDate = referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)
    ? new Date(referenceDateStr + 'T12:00:00')
    : new Date();

  const todayStr = toLocalISODate(baseDate);

  const cleanRaw = (rawDate || '').trim();
  const cleanExtra = (extraContext || '').trim();

  if (!cleanRaw && !cleanExtra) {
    return todayStr;
  }

  // 1. Direct standard ISO date YYYY-MM-DD
  const isoMatch = cleanRaw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Direct European date DD.MM.YYYY or DD/MM/YYYY
  const euMatch = cleanRaw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (euMatch) {
    const d = euMatch[1].padStart(2, '0');
    const m = euMatch[2].padStart(2, '0');
    const y = euMatch[3];
    return `${y}-${m}-${d}`;
  }

  const combined = `${cleanRaw} ${cleanExtra}`.trim();
  const normalized = normalizeText(combined);

  // 3. "Przedwczoraj"
  if (/\b(przedwczoraj|ereyesterday)\b/.test(normalized)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 2);
    return toLocalISODate(d);
  }

  // 4. "Wczoraj" / "Yesterday"
  if (/\b(wczoraj|yesterday)\b/.test(normalized)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 1);
    return toLocalISODate(d);
  }

  // 5. "Dziś" / "Dzisiaj" / "Today" / "Teraz"
  if (/\b(dzis|dzisiaj|today|teraz)\b/.test(normalized)) {
    return todayStr;
  }

  // 6. "X dni temu" / "X days ago"
  const daysAgoMatch = normalized.match(/(\d+)\s*(?:dni|dzien|d)\s*temu/) || normalized.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const offset = parseInt(daysAgoMatch[1], 10);
    if (!isNaN(offset) && offset > 0 && offset < 365) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - offset);
      return toLocalISODate(d);
    }
  }

  // 7. Dni tygodnia (charakterystyczne dla zestawień Apple Pay w ramach ostatniego tygodnia)
  for (const [name, targetDay] of Object.entries(WEEKDAYS_MAP)) {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(normalized)) {
      const currentDay = baseDate.getDay();
      let diff = (currentDay - targetDay + 7) % 7;
      if (diff === 0) {
        // W Apple Pay, gdyby to był dzisiejszy dzień, aplikacja pokazałaby "Dziś" lub godzinę.
        // Jeśli podano pełną nazwę dnia tygodnia, oznacza to 7 dni temu.
        diff = 7;
      }
      const d = new Date(baseDate);
      d.setDate(d.getDate() - diff);
      return toLocalISODate(d);
    }
  }

  // 8. Daty ze słownymi nazwami miesięcy (np. "7 września", "12 maja")
  for (const [mName, mNum] of Object.entries(POLISH_MONTHS)) {
    const regex = new RegExp(`(\\d{1,2})\\s+${mName}(?:\\s+(\\d{4}))?`, 'i');
    const mMatch = normalized.match(regex);
    if (mMatch) {
      const dayVal = parseInt(mMatch[1], 10);
      const yearVal = mMatch[2] ? parseInt(mMatch[2], 10) : baseDate.getFullYear();
      if (dayVal >= 1 && dayVal <= 31) {
        return `${yearVal}-${String(mNum).padStart(2, '0')}-${String(dayVal).padStart(2, '0')}`;
      }
    }
  }

  // 9. Sam format godziny np. "14:32" lub "08:15" z Apple Pay
  if (/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(cleanRaw)) {
    return todayStr;
  }

  // Jeśli data już pasuje do YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanRaw)) {
    return cleanRaw;
  }

  return todayStr;
}

/**
 * Zwraca czytelną etykietę relatywną do wyświetlenia w interfejsie (np. "Dziś", "Wczoraj", "Wtorek")
 */
export function getRelativeDateBadge(dateStr: string, referenceDateStr?: string): string | null {
  if (!dateStr) return null;
  const baseDate = referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)
    ? new Date(referenceDateStr + 'T12:00:00')
    : new Date();

  const targetDate = new Date(dateStr + 'T12:00:00');
  if (isNaN(targetDate.getTime())) return null;

  const diffTime = baseDate.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Dziś';
  if (diffDays === 1) return 'Wczoraj';
  if (diffDays === 2) return 'Przedwczoraj';
  if (diffDays > 2 && diffDays <= 6) {
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    return dayNames[targetDate.getDay()];
  }
  return null;
}
