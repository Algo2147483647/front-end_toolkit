"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileJson, Loader2, RefreshCcw, RotateCcw, Upload } from "lucide-react";
import type { AssetStatus, ValuationResponse } from "@/lib/valuation/types";

const sampleConfigPath = "/sample-config.json";

function formatUsd(value: number | null | undefined): string {
  if (value == null) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100000 ? 0 : 2
  }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value == null) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function statusDotTone(status: AssetStatus): string {
  if (status === "ok") {
    return "bg-[#34c759] shadow-[0_0_0_3px_rgba(52,199,89,0.14)]";
  }
  if (status === "warning") {
    return "bg-[#ff9f0a] shadow-[0_0_0_3px_rgba(255,159,10,0.14)]";
  }
  return "bg-[#ff3b30] shadow-[0_0_0_3px_rgba(255,59,48,0.14)]";
}

function conversionFactor(asset: ValuationResponse["assets"][number]): number | null {
  if (asset.usdValue == null || !Number.isFinite(asset.quantity) || asset.quantity === 0) {
    return null;
  }
  return asset.usdValue / asset.quantity;
}

function summarizeConfig(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      assetCount: 0,
      baseCurrency: "USD"
    };
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.assets)) {
    return {
      assetCount: 0,
      baseCurrency: "USD"
    };
  }

  return {
    assetCount: record.assets.length,
    baseCurrency: typeof record.baseCurrency === "string" ? record.baseCurrency.toUpperCase() : "USD"
  };
}

export function NetWorthDashboard() {
  const [jsonInput, setJsonInput] = useState("");
  const [fileName, setFileName] = useState("sample-config.json");
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => {
    try {
      if (!jsonInput.trim()) {
        return {
          value: null,
          error: "No JSON configuration loaded."
        };
      }
      return {
        value: JSON.parse(jsonInput) as unknown,
        error: null
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "Invalid JSON."
      };
    }
  }, [jsonInput]);

  const configSummary = useMemo(() => summarizeConfig(parsed.value), [parsed.value]);
  const canRefresh = !parsed.error && !loading;

  async function refreshValuation(configValue?: unknown) {
    const valueToPrice = configValue ?? parsed.value;
    if (!valueToPrice || (!configValue && parsed.error)) {
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const response = await fetch("/api/valuation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(valueToPrice)
      });
      const data = (await response.json()) as ValuationResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Valuation request failed.");
      }
      setValuation(data as ValuationResponse);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Valuation request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLocalJson(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const value = JSON.parse(text) as unknown;
      setJsonInput(text);
      setFileName(file.name);
      setValuation(null);
      setApiError(null);
      void refreshValuation(value);
    } catch (error) {
      setApiError(error instanceof Error ? `Invalid JSON file: ${error.message}` : "Invalid JSON file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function useSample() {
    void loadSampleConfig();
  }

  async function loadSampleConfig() {
    setSampleLoading(true);
    setApiError(null);
    try {
      const response = await fetch(sampleConfigPath, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`Failed to load sample JSON: HTTP ${response.status}.`);
      }
      const text = await response.text();
      const value = JSON.parse(text) as unknown;
      setJsonInput(text);
      setFileName("sample-config.json");
      setValuation(null);
      void refreshValuation(value);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load sample JSON.");
    } finally {
      setSampleLoading(false);
    }
  }

  useEffect(() => {
    void loadSampleConfig();
    // Load the local sample JSON once on startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assets = valuation?.assets ?? [];
  const hasFailures = (valuation?.failedAssetCount ?? 0) > 0;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  return (
    <main className="app-shell">
      <header className="topbar-shell">
        <div className="topbar-brand">
          <p className="eyebrow">USD BASE</p>
          <h1>Current Net Worth</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="studio-btn studio-btn-ghost">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Load JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void loadLocalJson(event.target.files?.[0])}
          />
          <button type="button" onClick={useSample} className="studio-btn studio-btn-ghost">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Sample
          </button>
          <button type="button" onClick={() => void refreshValuation()} disabled={!canRefresh} className="studio-btn studio-btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="h-4 w-4" aria-hidden="true" />}
            Refresh
          </button>
        </div>
      </header>

      <section className="workspace-shell">
        <aside className="control-panel">
          <div className="panel-section">
            <p className="control-label">Loaded Configuration</p>
            <div className="file-tile">
              <FileJson className="h-5 w-5 text-[#285fdf]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="m-0 truncate font-semibold text-[#162033]">{fileName}</p>
                <p className="m-0 mt-1 text-xs text-[#5f6d82]">
                  {configSummary.assetCount} assets · {configSummary.baseCurrency} valuation
                </p>
              </div>
            </div>
          </div>

          <div className="panel-section">
            <p className="control-label">Validation</p>
            {parsed.error ? (
              <p className="status-box status-error">{parsed.error}</p>
            ) : sampleLoading ? (
              <p className="status-box status-ok">Loading sample JSON...</p>
            ) : (
              <p className="status-box status-ok">JSON format is valid and ready to price.</p>
            )}
            {apiError ? <p className="status-box status-error">{apiError}</p> : null}
          </div>

        </aside>

        <section className="stage-panel">
          <div className="total-card">
            <div>
              <p className="eyebrow">Total Current Asset Value in USD</p>
              <p className="total-value">{loading && !valuation ? "Pricing..." : formatUsd(valuation?.totalUsd)}</p>
            </div>
            <div className="summary-chip-grid">
              <span>VALUED {valuation?.pricedAssetCount ?? 0}</span>
              <span className={hasFailures ? "text-[#a33838]" : "text-[#24724f]"}>FAILED {valuation?.failedAssetCount ?? 0}</span>
              <span>{valuation ? formatDate(valuation.generatedAt) : "Waiting for pricing"}</span>
            </div>
          </div>

          <div className="breakdown-panel">
            <div className="breakdown-heading">
              <h2>Asset Breakdown</h2>
              <span>{assets.length} ITEMS</span>
            </div>

            {assets.length === 0 ? (
              <div className="empty-state">{loading ? "Fetching latest valuation..." : "Load a JSON file or use the sample configuration."}</div>
            ) : (
              <div className="asset-ledger" role="table" aria-label="Asset breakdown">
                <div className="asset-ledger-head" role="row">
                  <span>Type</span>
                  <span>Asset</span>
                  <span>Quantity</span>
                  <span>FX</span>
                  <span>Price</span>
                </div>
                {assets.map((asset) => (
                  <button key={asset.id} type="button" className="asset-ledger-row" role="row" onClick={() => setSelectedAssetId(asset.id)}>
                    <div className="asset-cell asset-status-cell" role="cell">
                      <span className={`status-dot ${statusDotTone(asset.status)}`} aria-label={`Status ${asset.status}`} />
                      <span className="type-pill">{asset.type}</span>
                    </div>
                    <div className="asset-cell asset-name-cell" role="cell">
                      <strong>{asset.name}</strong>
                      <span>{asset.id}</span>
                    </div>
                    <div className="asset-cell" role="cell">
                      <strong>
                        {formatNumber(asset.quantity)} {asset.unit ?? asset.symbol ?? ""}
                      </strong>
                    </div>
                    <div className="asset-cell" role="cell">
                      <strong>{formatNumber(conversionFactor(asset), 6)}</strong>
                      <span>per {asset.unit ?? asset.symbol ?? asset.pricingCurrency ?? "unit"}</span>
                    </div>
                    <div className="asset-cell asset-usd-cell" role="cell">
                      <strong>{formatUsd(asset.usdValue)}</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      {selectedAsset ? (
        <div className="asset-modal" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title" onClick={() => setSelectedAssetId(null)}>
          <div className="asset-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="asset-dialog-header">
              <div>
                <p className="eyebrow">{selectedAsset.type}</p>
                <h2 id="asset-modal-title">{selectedAsset.name}</h2>
                <p>{selectedAsset.id}</p>
              </div>
              <button type="button" className="studio-btn studio-btn-ghost" onClick={() => setSelectedAssetId(null)}>
                Close
              </button>
            </div>
            <dl className="asset-detail-grid">
              <div>
                <dt>Status</dt>
                <dd>{selectedAsset.status}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selectedAsset.type}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>
                  {formatNumber(selectedAsset.quantity)} {selectedAsset.unit ?? selectedAsset.symbol ?? ""}
                </dd>
              </div>
              <div>
                <dt>Current Price</dt>
                <dd>{selectedAsset.price == null ? "N/A" : `${formatNumber(selectedAsset.price, 6)} ${selectedAsset.pricingCurrency ?? ""}`}</dd>
              </div>
              <div>
                <dt>Pricing Currency</dt>
                <dd>{selectedAsset.pricingCurrency ?? "N/A"}</dd>
              </div>
              <div>
                <dt>USD FX</dt>
                <dd>{formatNumber(selectedAsset.fxRateToUsd, 6)}</dd>
              </div>
              <div>
                <dt>USD Value</dt>
                <dd>{formatUsd(selectedAsset.usdValue)}</dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{formatDate(selectedAsset.updatedAt)}</dd>
              </div>
              <div className="detail-wide">
                <dt>Data Source</dt>
                <dd>{selectedAsset.source}</dd>
              </div>
              <div className="detail-wide">
                <dt>Status Detail</dt>
                <dd>{selectedAsset.message}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </main>
  );
}
