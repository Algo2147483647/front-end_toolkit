import type { HistoryInstrumentType, PriceHistoryCandle, PriceHistorySeries } from "./types";

export const PRICE_HISTORY_STORAGE_KEY = "asset-dashboard-price-history-v1";

const HEADER_ALIASES: Record<"date" | "open" | "high" | "low" | "close" | "volume", string[]> = {
  date: ["date", "time", "timestamp", "trading_date"],
  open: ["open", "o"],
  high: ["high", "h"],
  low: ["low", "l"],
  close: ["close", "c", "last"],
  volume: ["volume", "vol", "v"],
};

export function makePriceHistorySeriesKey(instrumentType: HistoryInstrumentType, instrumentId: string): string {
  return `${instrumentType}:${instrumentId}`;
}

export function parsePriceHistoryCsv(content: string): PriceHistoryCandle[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const header = parseCsvLine(lines[0]).map((cell) => normalizeHeader(cell));
  const dateIndex = findHeaderIndex(header, "date");
  const openIndex = findHeaderIndex(header, "open");
  const highIndex = findHeaderIndex(header, "high");
  const lowIndex = findHeaderIndex(header, "low");
  const closeIndex = findHeaderIndex(header, "close");
  const volumeIndex = findOptionalHeaderIndex(header, "volume");

  const entries = new Map<string, PriceHistoryCandle>();

  lines.slice(1).forEach((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const date = String(cells[dateIndex] || "").trim();
    if (!date) {
      throw new Error(`Row ${rowIndex + 2} is missing a date.`);
    }

    const open = parseRequiredNumber(cells[openIndex], rowIndex, "open");
    const high = parseRequiredNumber(cells[highIndex], rowIndex, "high");
    const low = parseRequiredNumber(cells[lowIndex], rowIndex, "low");
    const close = parseRequiredNumber(cells[closeIndex], rowIndex, "close");
    const volume = volumeIndex >= 0 && String(cells[volumeIndex] || "").trim() ? Number(cells[volumeIndex]) : undefined;

    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new Error(`Row ${rowIndex + 2} has inconsistent OHLC values.`);
    }

    entries.set(date, {
      date,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : undefined,
    });
  });

  return Array.from(entries.values()).sort((left, right) => toDateValue(left.date) - toDateValue(right.date));
}

export function normalizePriceHistoryStore(input: unknown): Record<string, PriceHistorySeries> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, Partial<PriceHistorySeries>>;
  const result: Record<string, PriceHistorySeries> = {};

  Object.entries(source).forEach(([key, series]) => {
    if (!series || typeof series !== "object") {
      return;
    }

    const instrumentType = series.instrumentType === "fx" || series.instrumentType === "backend" ? series.instrumentType : "quote";
    const instrumentId = String(series.instrumentId || "").trim();
    if (!instrumentId) {
      return;
    }

    const candles = Array.isArray(series.candles)
      ? series.candles
          .map((candle) => normalizeCandle(candle))
          .filter((candle): candle is PriceHistoryCandle => Boolean(candle))
          .sort((left, right) => toDateValue(left.date) - toDateValue(right.date))
      : [];

    if (!candles.length) {
      return;
    }

    result[key] = {
      key,
      instrumentType,
      instrumentId,
      label: String(series.label || instrumentId),
      sourceFileName: String(series.sourceFileName || "history.csv"),
      importedAt: String(series.importedAt || new Date().toISOString()),
      priceUnit: series.priceUnit ? String(series.priceUnit) : undefined,
      interval: series.interval === "1w" || series.interval === "1m" ? series.interval : series.interval === "1d" ? "1d" : undefined,
      candles,
    };
  });

  return result;
}

export function buildPriceHistoryTemplateCsv(label: string): string {
  return [
    "date,open,high,low,close,volume",
    "2026-05-01,100.2,101.6,99.8,101.1,1823400",
    "2026-05-02,101.1,102.4,100.7,102.0,1765200",
    "2026-05-05,102.0,103.3,101.4,101.8,1692100",
    "2026-05-06,101.8,104.1,101.2,103.7,2134500",
    `# Instrument: ${label}`,
  ].join("\n");
}

export function formatHistoryDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function findHeaderIndex(header: string[], field: keyof typeof HEADER_ALIASES): number {
  const index = findOptionalHeaderIndex(header, field);
  if (index >= 0) {
    return index;
  }
  throw new Error(`CSV is missing the "${field}" column.`);
}

function findOptionalHeaderIndex(header: string[], field: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[field];
  return header.findIndex((cell) => aliases.includes(cell));
}

function parseRequiredNumber(value: string | undefined, rowIndex: number, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowIndex + 2} has an invalid ${label} value.`);
  }
  return parsed;
}

function normalizeCandle(input: unknown): PriceHistoryCandle | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candle = input as Partial<PriceHistoryCandle>;
  const date = String(candle.date || "").trim();
  if (!date) {
    return null;
  }

  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const volume = candle.volume === undefined ? undefined : Number(candle.volume);

  if (![open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  return {
    date,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : undefined,
  };
}

function toDateValue(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
}
