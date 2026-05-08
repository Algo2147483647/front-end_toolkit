export type AssetType = "cash" | "gold" | "equity" | "fund" | "other";
export type AccountType = "bank" | "broker" | "wallet" | "vault" | "other";
export type TabKey = "overview" | "assets" | "prices" | "accounts";
export type ImportMode = "replace" | "merge";
export type HistoryInstrumentType = "quote" | "fx" | "backend";
export type BackendHistoryInterval = "1d" | "1w" | "1m";

export interface SnapshotMeta {
  schemaVersion: string;
  title: string;
  updatedAt: string;
}

export interface SnapshotSettings {
  baseCurrency: string;
  supportedBaseCurrencies: string[];
  locale: string;
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  defaultCurrency: string;
  country: string;
  notes: string;
  updatedAt: string;
}

export interface FxRate {
  id: string;
  currency: string;
  rateFromUsd: number;
  notes: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  market: string;
  unit: string;
  quoteCurrency: string;
  price: number;
  notes: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  accountId: string;
  currency?: string;
  amount?: number;
  quoteId?: string;
  quantity?: number;
  holdingType?: string;
  storageLocation?: string;
  notes: string;
  updatedAt: string;
}

export interface Snapshot {
  meta: SnapshotMeta;
  settings: SnapshotSettings;
  accounts: Account[];
  fxRates: FxRate[];
  quotes: Quote[];
  assets: Asset[];
}

export interface AssetRow {
  id: string;
  type: AssetType;
  name: string;
  symbol: string;
  accountId: string;
  accountName: string;
  originalDisplay: string;
  priceDisplay: string;
  marketValueDisplay: string;
  baseValue: number;
  exposureCurrency: string;
  market: string;
  updatedAt: string;
  holdingType: string;
  storageLocation: string;
  share: number;
}

export interface SeriesEntry {
  key: string;
  name: string;
  value: number;
  color?: string;
}

export interface PortfolioView {
  baseCurrency: string;
  totalBaseValue: number;
  assetRows: AssetRow[];
  typeSeries: SeriesEntry[];
  currencySeries: SeriesEntry[];
  accountSeries: SeriesEntry[];
  byType: Partial<Record<AssetType, { value: number; share: number }>>;
  topCurrency: null | { name: string; value: number; share: number };
  topAsset: null | AssetRow;
}

export interface AssetFormState {
  id: string;
  type: AssetType;
  name: string;
  accountId: string;
  currency: string;
  amount: string;
  quoteId: string;
  quantity: string;
  holdingType: string;
  storageLocation: string;
  notes: string;
}

export interface FxFormState {
  id: string;
  currency: string;
  rateToCny: string;
  notes: string;
}

export interface QuoteFormState {
  id: string;
  assetType: AssetType;
  symbol: string;
  name: string;
  market: string;
  unit: string;
  quoteCurrency: string;
  price: string;
  notes: string;
}

export interface AccountFormState {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  defaultCurrency: string;
  country: string;
  notes: string;
}

export interface AssetFilters {
  type: string;
  accountId: string;
  currency: string;
  market: string;
}

export interface PriceHistoryCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PriceHistorySeries {
  key: string;
  instrumentType: HistoryInstrumentType;
  instrumentId: string;
  label: string;
  sourceFileName: string;
  importedAt: string;
  priceUnit?: string;
  interval?: BackendHistoryInterval;
  candles: PriceHistoryCandle[];
}
