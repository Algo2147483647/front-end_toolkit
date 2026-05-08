import type { PriceHistoryCandle } from "../types";

const DEFAULT_API_BASE_URL = "";

export interface BackendAsset {
  asset_type: string;
  label: string;
  native_currency: string;
  aliases: string[];
  file_path: string;
}

export interface AssetHistoryQuery {
  assetType: string;
  startDate: string;
  endDate: string;
  timeInterval: "1d" | "1w" | "1m";
  priceUnit: string;
}

export interface BackendAssetHistory {
  asset_type: string;
  price_unit: string;
  source_currency: string;
  interval: string;
  start_time: string | null;
  end_time: string | null;
  records: PriceHistoryCandle[];
}

export function getBackendApiBaseUrl(): string {
  const configured = import.meta.env.VITE_ASSET_API_BASE_URL;
  return String(configured ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export async function fetchBackendAssets(): Promise<BackendAsset[]> {
  const payload = await fetchJson<{ assets: BackendAsset[] }>("/api/v1/assets");
  return Array.isArray(payload.assets) ? payload.assets : [];
}

export async function fetchBackendAssetHistory(query: AssetHistoryQuery): Promise<BackendAssetHistory> {
  const params = new URLSearchParams({
    asset_type: query.assetType,
    time_interval: query.timeInterval,
    price_unit: query.priceUnit,
  });

  if (query.startDate) {
    params.set("start_date", query.startDate);
  }
  if (query.endDate) {
    params.set("end_date", query.endDate);
  }

  return fetchJson<BackendAssetHistory>(`/api/v1/asset-history?${params.toString()}`);
}

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = getBackendApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `Backend request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
