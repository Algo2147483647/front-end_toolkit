export type AssetType = "gold" | "fx" | "stock_us" | "custom";
export type AssetStatus = "ok" | "warning" | "failed";

export type AssetConfig = GoldAsset | FxAsset | StockUsAsset | CustomAsset;

export interface PortfolioConfig {
  baseCurrency: "USD";
  assets: AssetConfig[];
}

export interface AssetBase {
  id: string;
  type: AssetType;
  name?: string;
  quantity: number;
}

export interface GoldAsset extends AssetBase {
  type: "gold";
  unit?: string;
}

export interface FxAsset extends AssetBase {
  type: "fx";
  currency: string;
}

export interface StockUsAsset extends AssetBase {
  type: "stock_us";
  symbol: string;
}

export interface CustomAsset extends AssetBase {
  type: "custom";
  price: number;
  currency: string;
}

export interface PricePoint {
  price: number;
  currency: string;
  unit?: string;
  source: string;
  updatedAt: string;
}

export interface FxRatePoint {
  rate: number;
  source: string;
  updatedAt: string;
}

export interface AssetValuation {
  id: string;
  type: AssetType;
  name: string;
  quantity: number;
  unit?: string;
  symbol?: string;
  price: number | null;
  pricingCurrency: string | null;
  priceUnit?: string;
  fxRateToUsd: number | null;
  usdValue: number | null;
  source: string;
  updatedAt: string | null;
  status: AssetStatus;
  message: string;
}

export interface ValuationResponse {
  baseCurrency: "USD";
  totalUsd: number;
  pricedAssetCount: number;
  failedAssetCount: number;
  generatedAt: string;
  assets: AssetValuation[];
}

export class ValuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValuationError";
  }
}
