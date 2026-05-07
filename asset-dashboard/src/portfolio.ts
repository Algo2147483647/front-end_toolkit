import type {
  Account,
  AccountType,
  Asset,
  AssetFormState,
  AssetRow,
  AssetType,
  FxFormState,
  FxRate,
  PortfolioView,
  Quote,
  QuoteFormState,
  SeriesEntry,
  Snapshot,
  AccountFormState,
} from "./types";

export const STORAGE_KEY = "asset-dashboard-snapshot-v2";

export const COLOR_PALETTE = [
  "#0f5c52",
  "#b4862f",
  "#7d3248",
  "#4066a4",
  "#7b8a3b",
  "#b55d34",
  "#5e4ba8",
  "#59626c",
];

export const EMPTY_ASSET_FORM: AssetFormState = {
  id: "",
  type: "cash",
  name: "",
  accountId: "",
  currency: "USD",
  amount: "",
  quoteId: "",
  quantity: "",
  holdingType: "",
  storageLocation: "",
  notes: "",
};

export const EMPTY_FX_FORM: FxFormState = {
  id: "",
  currency: "",
  rateToCny: "",
  notes: "",
};

export const EMPTY_QUOTE_FORM: QuoteFormState = {
  id: "",
  assetType: "gold",
  symbol: "",
  name: "",
  market: "",
  unit: "",
  quoteCurrency: "USD",
  price: "",
  notes: "",
};

export const EMPTY_ACCOUNT_FORM: AccountFormState = {
  id: "",
  name: "",
  institution: "",
  type: "bank",
  defaultCurrency: "USD",
  country: "",
  notes: "",
};

export function normalizeSnapshot(input: unknown): Snapshot {
  const now = new Date().toISOString();
  const source = (input && typeof input === "object" ? input : {}) as Partial<Snapshot>;

  return {
    meta: {
      schemaVersion: source.meta?.schemaVersion || "2.0.0",
      title: source.meta?.title || "Global Asset Net Worth Board",
      updatedAt: source.meta?.updatedAt || now,
    },
    settings: {
      baseCurrency: source.settings?.baseCurrency || "USD",
      supportedBaseCurrencies:
        Array.isArray(source.settings?.supportedBaseCurrencies) && source.settings.supportedBaseCurrencies.length
          ? source.settings.supportedBaseCurrencies.map((currency) => currency.toUpperCase())
          : ["USD", "CNY", "HKD"],
      locale: source.settings?.locale || "en-US",
    },
    accounts: Array.isArray(source.accounts) ? source.accounts.map((account) => normalizeAccount(account, now)) : [],
    fxRates: normalizeFxRates(Array.isArray(source.fxRates) ? source.fxRates : [], now),
    quotes: Array.isArray(source.quotes) ? source.quotes.map((quote) => normalizeQuote(quote, now)) : [],
    assets: Array.isArray(source.assets) ? source.assets.map((asset) => normalizeAsset(asset, now)) : [],
  };
}

function normalizeAccount(account: Partial<Account>, now: string): Account {
  return {
    id: account.id || makeId("acct"),
    name: account.name || "Untitled Account",
    institution: account.institution || "",
    type: (account.type as AccountType) || "other",
    defaultCurrency: (account.defaultCurrency || "USD").toUpperCase(),
    country: account.country || "",
    notes: account.notes || "",
    updatedAt: account.updatedAt || now,
  };
}

function normalizeFx(rate: Partial<FxRate> & { rateToCny?: number }, now: string): FxRate {
  return {
    id: rate.id || `fx-${String(rate.currency || "usd").toLowerCase()}`,
    currency: String(rate.currency || "USD").toUpperCase(),
    rateFromUsd: toNumber(rate.rateFromUsd),
    notes: rate.notes || "",
    updatedAt: rate.updatedAt || now,
  };
}

function normalizeFxRates(rawRates: Array<Partial<FxRate> & { rateToCny?: number }>, now: string): FxRate[] {
  const hasUsdSchema = rawRates.some((rate) => rate.rateFromUsd !== undefined);
  if (hasUsdSchema) {
    return ensureUsdRate(rawRates.map((rate) => normalizeFx(rate, now)));
  }

  const legacyUsdToCny = toNumber(
    rawRates.find((rate) => String(rate.currency || "").toUpperCase() === "USD")?.rateToCny,
  );

  const converted = rawRates.map((rate) => {
    const currency = String(rate.currency || "USD").toUpperCase();
    const legacyRateToCny = toNumber(rate.rateToCny);
    let rateFromUsd = 0;

    if (currency === "USD") {
      rateFromUsd = 1;
    } else if (currency === "CNY" && legacyUsdToCny) {
      rateFromUsd = legacyUsdToCny;
    } else if (legacyUsdToCny && legacyRateToCny) {
      rateFromUsd = legacyUsdToCny / legacyRateToCny;
    }

    return normalizeFx(
      {
        ...rate,
        currency,
        rateFromUsd,
      },
      now,
    );
  });

  return ensureUsdRate(converted);
}

function normalizeQuote(quote: Partial<Quote>, now: string): Quote {
  return {
    id: quote.id || makeId("quote"),
    symbol: quote.symbol || "UNKNOWN",
    name: quote.name || quote.symbol || "Untitled Quote",
    assetType: (quote.assetType as AssetType) || "other",
    market: quote.market || "",
    unit: quote.unit || "",
    quoteCurrency: String(quote.quoteCurrency || "CNY").toUpperCase(),
    price: toNumber(quote.price),
    notes: quote.notes || "",
    updatedAt: quote.updatedAt || now,
  };
}

function normalizeAsset(asset: Partial<Asset>, now: string): Asset {
  return {
    id: asset.id || makeId("asset"),
    type: (asset.type as AssetType) || "other",
    name: asset.name || "",
    accountId: asset.accountId || "",
    currency: asset.currency ? asset.currency.toUpperCase() : undefined,
    amount: asset.amount !== undefined ? toNumber(asset.amount) : undefined,
    quoteId: asset.quoteId || undefined,
    quantity: asset.quantity !== undefined ? toNumber(asset.quantity) : undefined,
    holdingType: asset.holdingType || "",
    storageLocation: asset.storageLocation || "",
    notes: asset.notes || "",
    updatedAt: asset.updatedAt || now,
  };
}

function ensureUsdRate(rates: FxRate[]): FxRate[] {
  if (rates.some((rate) => rate.currency === "USD")) {
    return rates;
  }

  return [
    {
      id: "fx-usd",
      currency: "USD",
      rateFromUsd: 1,
      notes: "Base currency",
      updatedAt: new Date().toISOString(),
    },
    ...rates,
  ];
}

export function mergeSnapshots(currentSnapshot: Snapshot, incomingSnapshot: Snapshot): Snapshot {
  return normalizeSnapshot({
    meta: {
      ...currentSnapshot.meta,
      ...incomingSnapshot.meta,
      updatedAt: new Date().toISOString(),
    },
    settings: {
      ...currentSnapshot.settings,
      ...incomingSnapshot.settings,
    },
    accounts: mergeCollection(currentSnapshot.accounts, incomingSnapshot.accounts),
    fxRates: mergeCollection(currentSnapshot.fxRates, incomingSnapshot.fxRates),
    quotes: mergeCollection(currentSnapshot.quotes, incomingSnapshot.quotes),
    assets: mergeCollection(currentSnapshot.assets, incomingSnapshot.assets),
  });
}

function mergeCollection<T extends { id: string }>(currentItems: T[], incomingItems: T[]): T[] {
  const map = new Map(currentItems.map((item) => [item.id, item]));
  incomingItems.forEach((item) => {
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function computePortfolio(snapshot: Snapshot): PortfolioView {
  const baseCurrency = snapshot.settings.baseCurrency || "CNY";
  const assetRows = snapshot.assets
    .map((asset) => toAssetRow(asset, snapshot, baseCurrency))
    .filter((row): row is AssetRow => Boolean(row))
    .sort((left, right) => right.baseValue - left.baseValue);

  const totalBaseValue = assetRows.reduce((sum, row) => sum + row.baseValue, 0);
  assetRows.forEach((row) => {
    row.share = totalBaseValue > 0 ? row.baseValue / totalBaseValue : 0;
  });

  const typeSeries = aggregateSeries(assetRows, "type");
  const currencySeries = aggregateSeries(assetRows, "exposureCurrency");
  const accountSeries = aggregateSeries(assetRows, "accountName");

  const byType: PortfolioView["byType"] = {};
  typeSeries.forEach((entry) => {
    byType[entry.key as AssetType] = {
      value: entry.value,
      share: totalBaseValue > 0 ? entry.value / totalBaseValue : 0,
    };
  });

  return {
    baseCurrency,
    totalBaseValue,
    assetRows,
    typeSeries,
    currencySeries,
    accountSeries,
    byType,
    topCurrency: currencySeries[0]
      ? {
          name: currencySeries[0].name,
          value: currencySeries[0].value,
          share: totalBaseValue > 0 ? currencySeries[0].value / totalBaseValue : 0,
        }
      : null,
    topAsset: assetRows[0] || null,
  };
}

function toAssetRow(asset: Asset, snapshot: Snapshot, baseCurrency: string): AssetRow | null {
  const accountName = lookupAccountName(asset.accountId, snapshot.accounts);
  const updatedAt = asset.updatedAt || snapshot.meta.updatedAt;

  if (asset.type === "cash") {
    const amount = toNumber(asset.amount);
    const exposureCurrency = asset.currency || "CNY";
    const baseValue = convertCurrency(amount, exposureCurrency, baseCurrency, snapshot.fxRates);

    return {
      id: asset.id,
      type: asset.type,
      name: asset.name || "Cash Balance",
      symbol: "",
      accountId: asset.accountId || "",
      accountName,
      originalDisplay: `${formatNumber(amount, snapshot.settings.locale, 2)} ${exposureCurrency}`,
      priceDisplay:
        exposureCurrency === "USD"
          ? "1.0000 USD"
          : `1 USD = ${formatNumber(getRateFromUsd(exposureCurrency, snapshot.fxRates), snapshot.settings.locale, 4)} ${exposureCurrency}`,
      marketValueDisplay: `${formatNumber(amount, snapshot.settings.locale, 2)} ${exposureCurrency}`,
      baseValue,
      exposureCurrency,
      market: "Cash",
      updatedAt,
      holdingType: asset.holdingType || "",
      storageLocation: asset.storageLocation || "",
      share: 0,
    };
  }

  const quote = snapshot.quotes.find((item) => item.id === asset.quoteId);
  if (!quote) {
    return null;
  }

  const quantity = toNumber(asset.quantity);
  const marketValue = quantity * toNumber(quote.price);
  const exposureCurrency = quote.quoteCurrency || "CNY";
  const baseValue = convertCurrency(marketValue, exposureCurrency, baseCurrency, snapshot.fxRates);

  return {
    id: asset.id,
    type: asset.type,
    name: asset.name || quote.name,
    symbol: quote.symbol,
    accountId: asset.accountId || "",
    accountName,
    originalDisplay: `${formatNumber(quantity, snapshot.settings.locale, 4)} ${quote.unit || "unit"}`,
    priceDisplay: `${formatNumber(quote.price, snapshot.settings.locale, 4)} ${exposureCurrency}/${quote.unit || "unit"}`,
    marketValueDisplay: `${formatNumber(marketValue, snapshot.settings.locale, 2)} ${exposureCurrency}`,
    baseValue,
    exposureCurrency,
    market: quote.market || "",
    updatedAt: latestTimestamp(updatedAt, quote.updatedAt),
    holdingType: asset.holdingType || "",
    storageLocation: asset.storageLocation || "",
    share: 0,
  };
}

function aggregateSeries(assetRows: AssetRow[], field: keyof AssetRow): SeriesEntry[] {
  const seriesMap = new Map<string, number>();

  assetRows.forEach((row) => {
    const key = String(row[field] || "Unclassified");
    seriesMap.set(key, (seriesMap.get(key) || 0) + row.baseValue);
  });

  return Array.from(seriesMap.entries())
    .map(([key, value]) => ({
      key,
      name: field === "type" ? typeLabel(key as AssetType) : key,
      value,
    }))
    .sort((left, right) => right.value - left.value);
}

export function getKnownCurrencies(snapshot: Snapshot): string[] {
  const values = new Set(["USD"]);
  snapshot.settings.supportedBaseCurrencies.forEach((currency) => values.add(currency.toUpperCase()));
  snapshot.fxRates.forEach((rate) => values.add(rate.currency.toUpperCase()));
  snapshot.assets.forEach((asset) => {
    if (asset.currency) {
      values.add(asset.currency.toUpperCase());
    }
  });
  snapshot.quotes.forEach((quote) => values.add(quote.quoteCurrency.toUpperCase()));
  return Array.from(values).sort();
}

export function getRateFromUsd(currency: string, rates: FxRate[]): number {
  const normalized = String(currency || "USD").toUpperCase();
  if (normalized === "USD") {
    return 1;
  }
  return rates.find((rate) => rate.currency === normalized)?.rateFromUsd || 0;
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rates: FxRate[]): number {
  const normalizedFrom = String(fromCurrency || "USD").toUpperCase();
  const normalizedTo = String(toCurrency || "USD").toUpperCase();
  const fromRate = getRateFromUsd(normalizedFrom, rates);
  const toRate = getRateFromUsd(normalizedTo, rates);

  if (!fromRate || !toRate) {
    return 0;
  }

  const usdValue = normalizedFrom === "USD" ? amount : amount / fromRate;
  return normalizedTo === "USD" ? usdValue : usdValue * toRate;
}

export function typeLabel(type: AssetType): string {
  return {
    cash: "Cash",
    gold: "Gold",
    equity: "Equity",
    fund: "Fund / ETF",
    other: "Other",
  }[type];
}

export function accountTypeLabel(type: AccountType): string {
  return {
    bank: "Bank",
    broker: "Broker",
    wallet: "Wallet",
    vault: "Vault",
    other: "Other",
  }[type];
}

export function lookupAccountName(accountId: string, accounts: Account[]): string {
  return accounts.find((account) => account.id === accountId)?.name || "";
}

export function formatMoney(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${formatNumber(value || 0, locale, 2)} ${currency}`;
  }
}

export function formatNumber(value: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

export function formatShare(value: number, locale: string): string {
  return `${formatNumber((value || 0) * 100, locale, 1)}%`;
}

export function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function latestTimestamp(...values: string[]): string {
  return values
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || new Date().toISOString();
}

export function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    const next = items.slice();
    next[index] = item;
    return next;
  }
  return [...items, item];
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
}

export function updateSnapshotTimestamp(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    meta: {
      ...snapshot.meta,
      updatedAt: new Date().toISOString(),
    },
  };
}
