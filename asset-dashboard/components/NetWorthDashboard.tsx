"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileJson, Loader2, RefreshCcw, RotateCcw, Upload, XCircle } from "lucide-react";
import type { AssetStatus, ValuationResponse } from "@/lib/valuation/types";

const sampleConfig = {
  baseCurrency: "USD",
  assets: [
    {
      id: "gold_001",
      type: "gold",
      name: "Physical Gold",
      quantity: 17,
      unit: "gram"
    },
    {
      id: "cash_cny_001",
      type: "fx",
      name: "CNY Cash",
      currency: "CNY",
      quantity: 500000
    },
    {
      id: "cash_hkd_001",
      type: "fx",
      name: "HKD Cash",
      currency: "HKD",
      quantity: 1000
    },
    {
      id: "cash_hkd_002",
      type: "fx",
      name: "HKD Cash Separate",
      currency: "HKD",
      quantity: 11223.76
    },
    {
      id: "cash_eur_001",
      type: "fx",
      name: "EUR Cash",
      currency: "EUR",
      quantity: 200
    },
    {
      id: "cash_chf_001",
      type: "fx",
      name: "CHF Cash",
      currency: "CHF",
      quantity: 2250
    },
    {
      id: "cash_usd_001",
      type: "fx",
      name: "USD Cash 850",
      currency: "USD",
      quantity: 850
    },
    {
      id: "cash_usd_002",
      type: "fx",
      name: "USD Cash 900",
      currency: "USD",
      quantity: 900
    }
  ]
};

const sampleJson = JSON.stringify(sampleConfig, null, 2);

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

function statusTone(status: AssetStatus): string {
  if (status === "ok") {
    return "border-[#2f8f6b]/25 bg-[#1e8f5a]/10 text-[#24724f]";
  }
  if (status === "warning") {
    return "border-[#ba8b34]/30 bg-[#d3982d]/12 text-[#8a611d]";
  }
  return "border-[#c44f4f]/30 bg-[#c04c4c]/10 text-[#a33838]";
}

function StatusIcon({ status }: { status: AssetStatus }) {
  if (status === "ok") {
    return <Check className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
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
  const [jsonInput, setJsonInput] = useState(sampleJson);
  const [fileName, setFileName] = useState("sample-config.json");
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => {
    try {
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
    setJsonInput(sampleJson);
    setFileName("sample-config.json");
    setValuation(null);
    setApiError(null);
    void refreshValuation(sampleConfig);
  }

  useEffect(() => {
    void refreshValuation(sampleConfig);
    // Run once to avoid an empty/N/A dashboard on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assets = valuation?.assets ?? [];
  const hasFailures = (valuation?.failedAssetCount ?? 0) > 0;

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
              <div className="asset-list">
                {assets.map((asset) => (
                  <article key={asset.id} className="asset-card">
                    <div className="asset-title">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`status-pill ${statusTone(asset.status)}`}>
                          <StatusIcon status={asset.status} />
                          {asset.status}
                        </span>
                        <span className="type-pill">{asset.type}</span>
                      </div>
                      <h3>{asset.name}</h3>
                      <p>{asset.id}</p>
                    </div>

                    <dl className="asset-meta">
                      <div>
                        <dt>Quantity</dt>
                        <dd>
                          {formatNumber(asset.quantity)} {asset.unit ?? asset.symbol ?? ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Price</dt>
                        <dd>{asset.price == null ? "N/A" : `${formatNumber(asset.price, 6)} ${asset.pricingCurrency ?? ""}`}</dd>
                      </div>
                      <div>
                        <dt>Currency</dt>
                        <dd>{asset.pricingCurrency ?? "N/A"}</dd>
                      </div>
                      <div>
                        <dt>USD FX</dt>
                        <dd>{formatNumber(asset.fxRateToUsd, 6)}</dd>
                      </div>
                      <div className="meta-wide">
                        <dt>Data Source</dt>
                        <dd>{asset.source}</dd>
                      </div>
                      <div className="meta-wide">
                        <dt>Last Updated</dt>
                        <dd>{formatDate(asset.updatedAt)}</dd>
                      </div>
                      <div className="meta-full">
                        <dt>Status Detail</dt>
                        <dd>{asset.message}</dd>
                      </div>
                    </dl>

                    <div className="asset-value">
                      <p>USD Value</p>
                      <strong>{formatUsd(asset.usdValue)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
