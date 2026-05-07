import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import sampleSnapshotJson from "../sample-data.json";
import "./app.css";
import {
  COLOR_PALETTE,
  EMPTY_ACCOUNT_FORM,
  EMPTY_ASSET_FORM,
  EMPTY_FX_FORM,
  EMPTY_QUOTE_FORM,
  STORAGE_KEY,
  accountTypeLabel,
  cloneSnapshot,
  computePortfolio,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatShare,
  getKnownCurrencies,
  lookupAccountName,
  makeId,
  mergeSnapshots,
  normalizeSnapshot,
  removeById,
  typeLabel,
  updateSnapshotTimestamp,
  upsertById,
  toNumber,
} from "./portfolio";
import type {
  Account,
  AccountFormState,
  Asset,
  AssetFilters,
  AssetFormState,
  AssetType,
  FxRate,
  ImportMode,
  Quote,
  QuoteFormState,
  SeriesEntry,
  Snapshot,
  TabKey,
} from "./types";

const SAMPLE_SNAPSHOT = normalizeSnapshot(sampleSnapshotJson);

const NAV_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Dashboard" },
  { key: "assets", label: "Assets" },
  { key: "prices", label: "Prices" },
  { key: "accounts", label: "Accounts" },
];

const DEFAULT_FILTERS: AssetFilters = {
  type: "all",
  accountId: "all",
  currency: "all",
  market: "all",
};

function loadSnapshot(): Snapshot {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneSnapshot(SAMPLE_SNAPSHOT);
    }
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return cloneSnapshot(SAMPLE_SNAPSHOT);
  }
}

async function fetchLatestUsdFxRates(currencies: string[]): Promise<{
  date: string;
  rates: FxRate[];
}> {
  const symbols = currencies
    .map((currency) => currency.toUpperCase())
    .filter((currency) => currency !== "USD")
    .sort();

  const query = symbols.length ? `?base=USD&symbols=${encodeURIComponent(symbols.join(","))}` : "?base=USD";
  const response = await fetch(`https://api.frankfurter.dev/v1/latest${query}`);

  if (!response.ok) {
    throw new Error(`FX request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    base: string;
    date: string;
    rates: Record<string, number>;
  };

  const rates: FxRate[] = [
    {
      id: "fx-usd",
      currency: "USD",
      rateFromUsd: 1,
      notes: "Online latest (Frankfurter, USD base)",
      updatedAt: new Date().toISOString(),
    },
    ...Object.entries(payload.rates || {}).map(([currency, rate]) => ({
      id: `fx-${currency.toLowerCase()}`,
      currency,
      rateFromUsd: rate,
      notes: "Online latest (Frankfurter, USD base)",
      updatedAt: new Date().toISOString(),
    })),
  ];

  return {
    date: payload.date,
    rates,
  };
}

function mergeFxRates(currentRates: FxRate[], fetchedRates: FxRate[]): FxRate[] {
  const map = new Map(currentRates.map((rate) => [rate.currency, rate]));
  fetchedRates.forEach((rate) => {
    map.set(rate.currency, rate);
  });
  return Array.from(map.values()).sort((left, right) => left.currency.localeCompare(right.currency));
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => loadSnapshot());
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [assetForm, setAssetForm] = useState<AssetFormState>(EMPTY_ASSET_FORM);
  const [fxForm, setFxForm] = useState(EMPTY_FX_FORM);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(EMPTY_QUOTE_FORM);
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [filters, setFilters] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [importStatus, setImportStatus] = useState("No file loaded.");
  const [fxSyncStatus, setFxSyncStatus] = useState("Not synced");
  const [isFxSyncing, setIsFxSyncing] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  useEffect(() => {
    void syncLatestFxRates("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valuation = computePortfolio(snapshot);
  const currencies = getKnownCurrencies(snapshot);
  const assetQuoteOptions = snapshot.quotes.filter((quote) => {
    if (assetForm.type === "cash") {
      return false;
    }
    if (assetForm.type === "other") {
      return quote.assetType === "other";
    }
    return quote.assetType === assetForm.type;
  });

  const filteredAssets = valuation.assetRows.filter((row) => {
    if (filters.type !== "all" && row.type !== filters.type) {
      return false;
    }
    if (filters.accountId !== "all" && row.accountId !== filters.accountId) {
      return false;
    }
    if (filters.currency !== "all" && row.exposureCurrency !== filters.currency) {
      return false;
    }
    if (filters.market !== "all" && row.market !== filters.market) {
      return false;
    }
    return true;
  });

  const accountValueMap = valuation.assetRows.reduce<Record<string, number>>((map, row) => {
    map[row.accountId || ""] = (map[row.accountId || ""] || 0) + row.baseValue;
    return map;
  }, {});

  const markets = Array.from(new Set(snapshot.quotes.map((quote) => quote.market).filter(Boolean))).sort();
  const topbarStatus = `${importStatus} · FX ${fxSyncStatus}`;

  function updateSnapshot(nextSnapshot: Snapshot) {
    setSnapshot(updateSnapshotTimestamp(normalizeSnapshot(nextSnapshot)));
  }

  async function syncLatestFxRates(trigger: "auto" | "manual") {
    try {
      setIsFxSyncing(true);
      setFxSyncStatus(trigger === "auto" ? "Syncing..." : "Refreshing...");
      const payload = await fetchLatestUsdFxRates(getKnownCurrencies(snapshot));
      setSnapshot((current) =>
        updateSnapshotTimestamp(
          normalizeSnapshot({
            ...current,
            settings: {
              ...current.settings,
              baseCurrency: current.settings.baseCurrency || "USD",
            },
            fxRates: mergeFxRates(current.fxRates, payload.rates),
          }),
        ),
      );
      setFxSyncStatus(`Synced · ${payload.date}`);
    } catch (error) {
      setFxSyncStatus("Sync failed");
    } finally {
      setIsFxSyncing(false);
    }
  }

  function handleBaseCurrencyChange(event: ChangeEvent<HTMLSelectElement>) {
    updateSnapshot({
      ...snapshot,
      settings: {
        ...snapshot.settings,
        baseCurrency: event.target.value,
      },
    });
  }

  function handleAssetFormChange<K extends keyof AssetFormState>(field: K, value: AssetFormState[K]) {
    setAssetForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "type") {
        const nextType = value as AssetType;
        if (nextType === "cash") {
          next.quoteId = "";
          next.quantity = "";
          next.holdingType = "";
          next.storageLocation = "";
        } else {
          next.currency = "USD";
          next.amount = "";
          const matchingQuote = snapshot.quotes.find((quote) =>
            nextType === "other" ? quote.assetType === "other" : quote.assetType === nextType,
          );
          next.quoteId = matchingQuote?.id || "";
        }
      }
      return next;
    });
  }

  function handleFxFormChange<K extends keyof typeof fxForm>(field: K, value: (typeof fxForm)[K]) {
    setFxForm((current) => ({ ...current, [field]: value }));
  }

  function handleQuoteFormChange<K extends keyof QuoteFormState>(field: K, value: QuoteFormState[K]) {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  }

  function handleAccountFormChange<K extends keyof AccountFormState>(field: K, value: AccountFormState[K]) {
    setAccountForm((current) => ({ ...current, [field]: value }));
  }

  function resetAssetForm() {
    setAssetForm(EMPTY_ASSET_FORM);
  }

  function resetFxForm() {
    setFxForm(EMPTY_FX_FORM);
  }

  function resetQuoteForm() {
    setQuoteForm(EMPTY_QUOTE_FORM);
  }

  function resetAccountForm() {
    setAccountForm(EMPTY_ACCOUNT_FORM);
  }

  function handleAssetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (assetForm.type === "cash") {
      if (!assetForm.currency || !assetForm.amount) {
        window.alert("Cash assets require a currency and an amount.");
        return;
      }
    } else if (!assetForm.quoteId || !assetForm.quantity) {
      window.alert("Quoted assets require a price reference and a quantity.");
      return;
    }

    const now = new Date().toISOString();
    const nextAsset: Asset = {
      id: assetForm.id || makeId("asset"),
      type: assetForm.type,
      name: assetForm.name.trim(),
      accountId: assetForm.accountId,
      notes: assetForm.notes.trim(),
      updatedAt: now,
    };

    if (assetForm.type === "cash") {
      nextAsset.currency = assetForm.currency.toUpperCase();
      nextAsset.amount = toNumber(assetForm.amount);
      if (!nextAsset.name) {
        nextAsset.name = `${lookupAccountName(nextAsset.accountId, snapshot.accounts) || "Unassigned"} ${nextAsset.currency}`;
      }
    } else {
      const selectedQuote = snapshot.quotes.find((quote) => quote.id === assetForm.quoteId);
      if (!selectedQuote) {
        window.alert("Please choose a valid quote reference.");
        return;
      }

      nextAsset.quoteId = assetForm.quoteId;
      nextAsset.quantity = toNumber(assetForm.quantity);
      nextAsset.holdingType = assetForm.holdingType.trim();
      nextAsset.storageLocation = assetForm.storageLocation.trim();
      if (!nextAsset.name) {
        nextAsset.name = `${selectedQuote.name} Position`;
      }
    }

    updateSnapshot({
      ...snapshot,
      assets: upsertById(snapshot.assets, nextAsset),
    });
    resetAssetForm();
  }

  function handleFxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fxForm.currency || !fxForm.rateToCny) {
      window.alert("FX rates require a currency and a USD-based cross rate.");
      return;
    }

    const nextRate: FxRate = {
      id: fxForm.id || `fx-${fxForm.currency.trim().toLowerCase()}`,
      currency: fxForm.currency.trim().toUpperCase(),
      rateFromUsd: toNumber(fxForm.rateToCny),
      notes: fxForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    updateSnapshot({
      ...snapshot,
      fxRates: upsertById(snapshot.fxRates, nextRate),
    });
    resetFxForm();
  }

  function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quoteForm.symbol || !quoteForm.name || !quoteForm.price) {
      window.alert("Quotes require a symbol, a name, and a current price.");
      return;
    }

    const nextQuote: Quote = {
      id: quoteForm.id || makeId("quote"),
      assetType: quoteForm.assetType,
      symbol: quoteForm.symbol.trim(),
      name: quoteForm.name.trim(),
      market: quoteForm.market.trim(),
      unit: quoteForm.unit.trim(),
      quoteCurrency: quoteForm.quoteCurrency.toUpperCase(),
      price: toNumber(quoteForm.price),
      notes: quoteForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    updateSnapshot({
      ...snapshot,
      quotes: upsertById(snapshot.quotes, nextQuote),
    });
    resetQuoteForm();
  }

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountForm.name) {
      window.alert("Accounts require a name.");
      return;
    }

    const nextAccount: Account = {
      id: accountForm.id || makeId("acct"),
      name: accountForm.name.trim(),
      institution: accountForm.institution.trim(),
      type: accountForm.type,
      defaultCurrency: accountForm.defaultCurrency.toUpperCase(),
      country: accountForm.country.trim(),
      notes: accountForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    updateSnapshot({
      ...snapshot,
      accounts: upsertById(snapshot.accounts, nextAccount),
    });
    resetAccountForm();
  }

  function editAsset(assetId: string) {
    const asset = snapshot.assets.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }

    setActiveTab("assets");
    setAssetForm({
      id: asset.id,
      type: asset.type,
      name: asset.name,
      accountId: asset.accountId,
      currency: asset.currency || "CNY",
      amount: asset.amount === undefined ? "" : String(asset.amount),
      quoteId: asset.quoteId || "",
      quantity: asset.quantity === undefined ? "" : String(asset.quantity),
      holdingType: asset.holdingType || "",
      storageLocation: asset.storageLocation || "",
      notes: asset.notes,
    });
  }

  function editFx(rateId: string) {
    const rate = snapshot.fxRates.find((item) => item.id === rateId);
    if (!rate) {
      return;
    }

    setActiveTab("prices");
    setFxForm({
      id: rate.id,
      currency: rate.currency,
      rateToCny: String(rate.rateFromUsd),
      notes: rate.notes,
    });
  }

  function editQuote(quoteId: string) {
    const quote = snapshot.quotes.find((item) => item.id === quoteId);
    if (!quote) {
      return;
    }

    setActiveTab("prices");
    setQuoteForm({
      id: quote.id,
      assetType: quote.assetType,
      symbol: quote.symbol,
      name: quote.name,
      market: quote.market,
      unit: quote.unit,
      quoteCurrency: quote.quoteCurrency,
      price: String(quote.price),
      notes: quote.notes,
    });
  }

  function editAccount(accountId: string) {
    const account = snapshot.accounts.find((item) => item.id === accountId);
    if (!account) {
      return;
    }

    setActiveTab("accounts");
    setAccountForm({
      id: account.id,
      name: account.name,
      institution: account.institution,
      type: account.type,
      defaultCurrency: account.defaultCurrency,
      country: account.country,
      notes: account.notes,
    });
  }

  function deleteAsset(assetId: string) {
    updateSnapshot({
      ...snapshot,
      assets: removeById(snapshot.assets, assetId),
    });
  }

  function deleteFx(rateId: string) {
    updateSnapshot({
      ...snapshot,
      fxRates: removeById(snapshot.fxRates, rateId),
    });
  }

  function deleteQuote(quoteId: string) {
    updateSnapshot({
      ...snapshot,
      quotes: removeById(snapshot.quotes, quoteId),
      assets: snapshot.assets.filter((asset) => asset.quoteId !== quoteId),
    });
  }

  function deleteAccount(accountId: string) {
    updateSnapshot({
      ...snapshot,
      accounts: removeById(snapshot.accounts, accountId),
      assets: snapshot.assets.map((asset) => (asset.accountId === accountId ? { ...asset, accountId: "" } : asset)),
    });
  }

  function handleFilterChange<K extends keyof AssetFilters>(field: K, value: AssetFilters[K]) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const incoming = normalizeSnapshot(JSON.parse(text));
      const nextSnapshot = importMode === "replace" ? incoming : mergeSnapshots(snapshot, incoming);
      updateSnapshot(nextSnapshot);
      setImportStatus(`Imported · ${file.name}`);
      event.target.value = "";
    } catch (error) {
      setImportStatus("Import failed");
    }
  }

  function loadSampleSnapshot() {
    setSnapshot(cloneSnapshot(SAMPLE_SNAPSHOT));
    setImportStatus("Sample loaded");
    setFxSyncStatus("Sample loaded");
  }

  function downloadBlob(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    downloadBlob(
      "global-asset-net-worth-board.snapshot.json",
      JSON.stringify(snapshot, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    const rows = [
      [
        "Asset",
        "Type",
        "Account",
        "Currency",
        "Original Value",
        "Current Price",
        "Current Market Value",
        `Converted ${valuation.baseCurrency}`,
        "Weight",
        "Updated At",
      ],
      ...valuation.assetRows.map((row) => [
        row.name,
        typeLabel(row.type),
        row.accountName || "Unassigned",
        row.exposureCurrency,
        row.originalDisplay,
        row.priceDisplay,
        row.marketValueDisplay,
        formatNumber(row.baseValue, snapshot.settings.locale, 2),
        formatShare(row.share, snapshot.settings.locale),
        formatDateTime(row.updatedAt, snapshot.settings.locale),
      ]),
    ];

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((value) => {
              const cell = String(value ?? "");
              return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
            })
            .join(","),
        )
        .join("\n");

    downloadBlob("global-asset-net-worth-board.assets.csv", csv, "text/csv;charset=utf-8");
  }

  const summaryCards = [
    {
      label: "Total Net Worth",
      value: formatMoney(valuation.totalBaseValue, valuation.baseCurrency, snapshot.settings.locale),
      subtle: `${valuation.baseCurrency} reporting base`,
    },
    {
      label: "Cash",
      value: formatMoney(valuation.byType.cash?.value || 0, valuation.baseCurrency, snapshot.settings.locale),
      subtle: formatShare(valuation.byType.cash?.share || 0, snapshot.settings.locale),
    },
    {
      label: "Gold",
      value: formatMoney(valuation.byType.gold?.value || 0, valuation.baseCurrency, snapshot.settings.locale),
      subtle: formatShare(valuation.byType.gold?.share || 0, snapshot.settings.locale),
    },
    {
      label: "Equities",
      value: formatMoney(
        (valuation.byType.equity?.value || 0) + (valuation.byType.fund?.value || 0),
        valuation.baseCurrency,
        snapshot.settings.locale,
      ),
      subtle: "Equity + Fund / ETF",
    },
    {
      label: "Largest Currency Exposure",
      value: valuation.topCurrency ? valuation.topCurrency.name : "-",
      subtle: valuation.topCurrency
        ? `${formatMoney(valuation.topCurrency.value, valuation.baseCurrency, snapshot.settings.locale)} · ${formatShare(valuation.topCurrency.share, snapshot.settings.locale)}`
        : "No data yet",
    },
    {
      label: "Largest Single Asset",
      value: valuation.topAsset ? valuation.topAsset.name : "-",
      subtle: valuation.topAsset
        ? `${formatMoney(valuation.topAsset.baseValue, valuation.baseCurrency, snapshot.settings.locale)} · ${formatShare(valuation.topAsset.share, snapshot.settings.locale)}`
        : "No data yet",
    },
  ];

  const insights = [];
  if (!valuation.assetRows.length) {
    insights.push("No data");
  }
  if (valuation.topAsset && valuation.topAsset.share >= 0.35) {
    insights.push(`Single asset high · ${valuation.topAsset.name} · ${formatShare(valuation.topAsset.share, snapshot.settings.locale)}`);
  }
  if (valuation.topCurrency && valuation.topCurrency.share >= 0.55) {
    insights.push(`FX concentration · ${valuation.topCurrency.name} · ${formatShare(valuation.topCurrency.share, snapshot.settings.locale)}`);
  }
  if ((valuation.byType.cash?.share || 0) >= 0.6) {
    insights.push(`Cash high · ${formatShare(valuation.byType.cash?.share || 0, snapshot.settings.locale)}`);
  }
  if ((valuation.byType.gold?.share || 0) >= 0.25) {
    insights.push(`Gold high · ${formatShare(valuation.byType.gold?.share || 0, snapshot.settings.locale)}`);
  }
  if (!insights.length) {
    insights.push("Balanced");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="nav-tabs" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-tab${activeTab === item.key ? " active" : ""}`}
              type="button"
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-brand">
            <h1>Asset Board</h1>
          </div>

          <div className="topbar-actions">
            <div className="topbar-group">
              <select className="topbar-select" value={snapshot.settings.baseCurrency} onChange={handleBaseCurrencyChange}>
                {snapshot.settings.supportedBaseCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    Base · {currency}
                  </option>
                ))}
              </select>
            </div>

            <div className="topbar-group">
              <select className="topbar-select" value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
                <option value="replace">Import · Replace</option>
                <option value="merge">Import · Merge</option>
              </select>
              <label className="topbar-file-label">
                <span>Load JSON</span>
                <input type="file" accept=".json,application/json" onChange={handleImportFile} />
              </label>
              <button className="ghost-btn" type="button" onClick={loadSampleSnapshot}>
                Sample
              </button>
            </div>

            <div className="topbar-group">
              <button className="ghost-btn" type="button" onClick={exportJson}>
                Export JSON
              </button>
              <button className="ghost-btn" type="button" onClick={exportCsv}>
                Export CSV
              </button>
            </div>

            <div className="topbar-group">
              <button className="primary-btn" type="button" onClick={() => void syncLatestFxRates("manual")} disabled={isFxSyncing}>
                {isFxSyncing ? "Refreshing..." : "Refresh FX"}
              </button>
            </div>

            <p className="graph-summary">
              {topbarStatus}
              <br />
              Updated · {formatDateTime(snapshot.meta.updatedAt, snapshot.settings.locale)} · Assets · {snapshot.assets.length}
            </p>
          </div>
        </header>

        {activeTab === "overview" && (
          <section className="panel active">
            <div className="summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="summary-card">
                  <span className="label">{card.label}</span>
                  <span className="value">{card.value}</span>
                  <span className="subtle">{card.subtle}</span>
                </article>
              ))}
            </div>

            <div className="two-column">
              <section className="surface-card">
                <div className="section-heading">
                  <h3>Asset Mix</h3>
                </div>
                <DonutCard series={valuation.typeSeries} baseCurrency={valuation.baseCurrency} locale={snapshot.settings.locale} label="Asset Type" />
              </section>

              <section className="surface-card">
                <div className="section-heading">
                  <h3>Currency Mix</h3>
                </div>
                <DonutCard series={valuation.currencySeries} baseCurrency={valuation.baseCurrency} locale={snapshot.settings.locale} label="Currency" />
              </section>
            </div>

            <div className="two-column">
              <section className="surface-card">
                <div className="section-heading">
                  <h3>Account Mix</h3>
                </div>
                <DonutCard series={valuation.accountSeries} baseCurrency={valuation.baseCurrency} locale={snapshot.settings.locale} label="Account" />
              </section>

              <section className="surface-card">
                <div className="section-heading">
                  <h3>Top Assets</h3>
                </div>
                <BarsCard
                  items={valuation.assetRows.slice(0, 8).map((row) => ({
                    name: row.name,
                    value: row.baseValue,
                    share: row.share,
                  }))}
                  baseCurrency={valuation.baseCurrency}
                  locale={snapshot.settings.locale}
                />
              </section>
            </div>

            <section className="surface-card">
              <div className="section-heading">
                <h3>Signals</h3>
              </div>
              <div className="insights-list">
                {insights.map((insight) => (
                  <div key={insight} className={`insight${insight.includes("high") || insight.includes("material") ? " warning" : ""}`}>
                    {insight}
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeTab === "assets" && (
          <section className="panel active">
            <div className="section-heading">
              <h3>Asset Entry</h3>
            </div>

            <div className="surface-card form-card">
              <form className="form-grid" onSubmit={handleAssetSubmit}>
                <label>
                  <span>Asset Type</span>
                  <select className="field-input" value={assetForm.type} onChange={(event) => handleAssetFormChange("type", event.target.value as AssetType)}>
                    <option value="cash">Cash</option>
                    <option value="gold">Gold</option>
                    <option value="equity">Equity</option>
                    <option value="fund">Fund / ETF</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  <span>Asset Name</span>
                  <input className="field-input" value={assetForm.name} onChange={(event) => handleAssetFormChange("name", event.target.value)} placeholder="US Dollar Cash / Apple Position / Gold Bar" />
                </label>

                <label>
                  <span>Account</span>
                  <select className="field-input" value={assetForm.accountId} onChange={(event) => handleAssetFormChange("accountId", event.target.value)}>
                    <option value="">Unassigned</option>
                    {snapshot.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                {assetForm.type === "cash" ? (
                  <>
                    <label>
                      <span>Currency</span>
                      <select className="field-input" value={assetForm.currency} onChange={(event) => handleAssetFormChange("currency", event.target.value)}>
                        {currencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Current Amount</span>
                      <input className="field-input" type="number" min="0" step="0.0001" value={assetForm.amount} onChange={(event) => handleAssetFormChange("amount", event.target.value)} placeholder="2000" />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>Holding Category</span>
                      <input className="field-input" value={assetForm.holdingType} onChange={(event) => handleAssetFormChange("holdingType", event.target.value)} placeholder="Bullion / US Equity / HK Equity / ETF" />
                    </label>
                    <label>
                      <span>Price Reference</span>
                      <select className="field-input" value={assetForm.quoteId} onChange={(event) => handleAssetFormChange("quoteId", event.target.value)}>
                        <option value="">Select a quote</option>
                        {assetQuoteOptions.map((quote) => (
                          <option key={quote.id} value={quote.id}>
                            {quote.symbol} · {quote.name} · {quote.price} {quote.quoteCurrency}/{quote.unit || "unit"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Quantity</span>
                      <input className="field-input" type="number" min="0" step="0.0001" value={assetForm.quantity} onChange={(event) => handleAssetFormChange("quantity", event.target.value)} placeholder="10 / 100 / 1000" />
                    </label>
                    <label>
                      <span>Storage / Venue</span>
                      <input className="field-input" value={assetForm.storageLocation} onChange={(event) => handleAssetFormChange("storageLocation", event.target.value)} placeholder="Home vault / IBKR / HSBC HK" />
                    </label>
                  </>
                )}

                <label className="wide">
                  <span>Notes</span>
                  <textarea className="field-input" rows={3} value={assetForm.notes} onChange={(event) => handleAssetFormChange("notes", event.target.value)} placeholder="Optional notes" />
                </label>

                <div className="form-actions wide">
                  <button className="primary-btn" type="submit">
                    Save Asset
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetAssetForm}>
                    Reset Form
                  </button>
                </div>
              </form>
            </div>

            <div className="surface-card">
              <div className="filters">
                <label>
                  <span>Asset Type</span>
                  <select className="field-input" value={filters.type} onChange={(event) => handleFilterChange("type", event.target.value)}>
                    <option value="all">All Assets</option>
                    <option value="cash">Cash</option>
                    <option value="gold">Gold</option>
                    <option value="equity">Equity</option>
                    <option value="fund">Fund / ETF</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  <span>Account</span>
                  <select className="field-input" value={filters.accountId} onChange={(event) => handleFilterChange("accountId", event.target.value)}>
                    <option value="all">All Accounts</option>
                    {snapshot.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Currency</span>
                  <select className="field-input" value={filters.currency} onChange={(event) => handleFilterChange("currency", event.target.value)}>
                    <option value="all">All Currencies</option>
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Market</span>
                  <select className="field-input" value={filters.market} onChange={(event) => handleFilterChange("market", event.target.value)}>
                    <option value="all">All Markets</option>
                    <option value="Cash">Cash</option>
                    {markets.map((market) => (
                      <option key={market} value={market}>
                        {market}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Account</th>
                      <th>Original Value</th>
                      <th>Current Price</th>
                      <th>Current Market Value</th>
                      <th>Converted Value</th>
                      <th>Weight</th>
                      <th>Updated At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredAssets.length ? (
                      <tr>
                        <td colSpan={10} className="empty-state">
                          No assets match the current filter set.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.name}</strong>
                            <br />
                            <span className="muted">{row.symbol || row.holdingType || "-"}</span>
                          </td>
                          <td>
                            <span className="tag">{typeLabel(row.type)}</span>
                          </td>
                          <td>{row.accountName || "Unassigned"}</td>
                          <td>{row.originalDisplay}</td>
                          <td>{row.priceDisplay}</td>
                          <td>{row.marketValueDisplay}</td>
                          <td>{formatMoney(row.baseValue, valuation.baseCurrency, snapshot.settings.locale)}</td>
                          <td>{formatShare(row.share, snapshot.settings.locale)}</td>
                          <td>{formatDateTime(row.updatedAt, snapshot.settings.locale)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="table-action" type="button" onClick={() => editAsset(row.id)}>
                                Edit
                              </button>
                              <button className="table-action" type="button" onClick={() => deleteAsset(row.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "prices" && (
          <section className="panel active">
            <div className="section-heading">
              <h3>FX and Price Center</h3>
            </div>

            <div className="two-column">
              <section className="surface-card form-card">
                <div className="section-heading">
                  <h4>FX Rates</h4>
                </div>
                <form className="form-grid compact" onSubmit={handleFxSubmit}>
                  <label>
                    <span>Currency</span>
                    <input className="field-input" value={fxForm.currency} onChange={(event) => handleFxFormChange("currency", event.target.value)} placeholder="USD / HKD / JPY" />
                  </label>

                  <label>
                    <span>Per USD</span>
                    <input className="field-input" type="number" min="0" step="0.0001" value={fxForm.rateToCny} onChange={(event) => handleFxFormChange("rateToCny", event.target.value)} placeholder="7.20 for CNY / 7.83 for HKD / 150 for JPY" />
                  </label>

                  <label className="wide">
                    <span>Notes</span>
                    <input className="field-input" value={fxForm.notes} onChange={(event) => handleFxFormChange("notes", event.target.value)} placeholder="Manual override / unsupported currency / custom source" />
                  </label>

                  <div className="form-actions wide">
                    <button className="primary-btn" type="submit">
                      Save FX Rate
                    </button>
                    <button className="ghost-btn" type="button" onClick={resetFxForm}>
                      Reset Form
                    </button>
                  </div>
                </form>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Per USD</th>
                        <th>Notes</th>
                        <th>Updated At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!snapshot.fxRates.length ? (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            No FX rates yet.
                          </td>
                        </tr>
                      ) : (
                        snapshot.fxRates
                          .slice()
                          .sort((left, right) => left.currency.localeCompare(right.currency))
                          .map((rate) => (
                            <tr key={rate.id}>
                              <td>{rate.currency}</td>
                              <td>{formatNumber(rate.rateFromUsd, snapshot.settings.locale, 4)}</td>
                              <td>{rate.notes || "-"}</td>
                              <td>{formatDateTime(rate.updatedAt, snapshot.settings.locale)}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="table-action" type="button" onClick={() => editFx(rate.id)}>
                                    Edit
                                  </button>
                                  <button className="table-action" type="button" onClick={() => deleteFx(rate.id)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="surface-card form-card">
                <h4>Asset Quotes</h4>
                <form className="form-grid compact" onSubmit={handleQuoteSubmit}>
                  <label>
                    <span>Asset Type</span>
                    <select className="field-input" value={quoteForm.assetType} onChange={(event) => handleQuoteFormChange("assetType", event.target.value as AssetType)}>
                      <option value="gold">Gold</option>
                      <option value="equity">Equity</option>
                      <option value="fund">Fund / ETF</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label>
                    <span>Symbol / Identifier</span>
                    <input className="field-input" value={quoteForm.symbol} onChange={(event) => handleQuoteFormChange("symbol", event.target.value)} placeholder="AAPL / 00700.HK / XAU-CNY-G" />
                  </label>

                  <label>
                    <span>Name</span>
                    <input className="field-input" value={quoteForm.name} onChange={(event) => handleQuoteFormChange("name", event.target.value)} placeholder="Apple / Tencent / Gold RMB Gram Price" />
                  </label>

                  <label>
                    <span>Market</span>
                    <input className="field-input" value={quoteForm.market} onChange={(event) => handleQuoteFormChange("market", event.target.value)} placeholder="US / HK / CN / OTC" />
                  </label>

                  <label>
                    <span>Unit</span>
                    <input className="field-input" value={quoteForm.unit} onChange={(event) => handleQuoteFormChange("unit", event.target.value)} placeholder="share / g / oz / lot" />
                  </label>

                  <label>
                    <span>Quote Currency</span>
                    <select className="field-input" value={quoteForm.quoteCurrency} onChange={(event) => handleQuoteFormChange("quoteCurrency", event.target.value)}>
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Current Price</span>
                    <input className="field-input" type="number" min="0" step="0.0001" value={quoteForm.price} onChange={(event) => handleQuoteFormChange("price", event.target.value)} placeholder="190 / 550 / 3.8" />
                  </label>

                  <label className="wide">
                    <span>Notes</span>
                    <input className="field-input" value={quoteForm.notes} onChange={(event) => handleQuoteFormChange("notes", event.target.value)} placeholder="Manual input / close / indicative quote" />
                  </label>

                  <div className="form-actions wide">
                    <button className="primary-btn" type="submit">
                      Save Quote
                    </button>
                    <button className="ghost-btn" type="button" onClick={resetQuoteForm}>
                      Reset Form
                    </button>
                  </div>
                </form>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Price</th>
                        <th>Currency</th>
                        <th>Unit</th>
                        <th>Updated At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!snapshot.quotes.length ? (
                        <tr>
                          <td colSpan={8} className="empty-state">
                            No quotes yet.
                          </td>
                        </tr>
                      ) : (
                        snapshot.quotes
                          .slice()
                          .sort((left, right) => left.symbol.localeCompare(right.symbol))
                          .map((quote) => (
                            <tr key={quote.id}>
                              <td>{quote.symbol}</td>
                              <td>{quote.name}</td>
                              <td>
                                <span className="tag">{typeLabel(quote.assetType)}</span>
                              </td>
                              <td>{formatNumber(quote.price, snapshot.settings.locale, 4)}</td>
                              <td>{quote.quoteCurrency}</td>
                              <td>{quote.unit || "-"}</td>
                              <td>{formatDateTime(quote.updatedAt, snapshot.settings.locale)}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="table-action" type="button" onClick={() => editQuote(quote.id)}>
                                    Edit
                                  </button>
                                  <button className="table-action" type="button" onClick={() => deleteQuote(quote.id)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        )}

        {activeTab === "accounts" && (
          <section className="panel active">
            <div className="section-heading">
              <h3>Account Registry</h3>
            </div>

            <div className="surface-card form-card">
              <form className="form-grid" onSubmit={handleAccountSubmit}>
                <label>
                  <span>Account Name</span>
                  <input className="field-input" value={accountForm.name} onChange={(event) => handleAccountFormChange("name", event.target.value)} placeholder="China Merchants Bank / HSBC HK / IBKR" />
                </label>

                <label>
                  <span>Institution</span>
                  <input className="field-input" value={accountForm.institution} onChange={(event) => handleAccountFormChange("institution", event.target.value)} placeholder="Bank / Broker / Wallet / Vault" />
                </label>

                <label>
                  <span>Account Type</span>
                  <select className="field-input" value={accountForm.type} onChange={(event) => handleAccountFormChange("type", event.target.value as Account["type"])}>
                    <option value="bank">Bank</option>
                    <option value="broker">Broker</option>
                    <option value="wallet">Wallet</option>
                    <option value="vault">Vault</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  <span>Default Currency</span>
                  <select className="field-input" value={accountForm.defaultCurrency} onChange={(event) => handleAccountFormChange("defaultCurrency", event.target.value)}>
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Country / Region</span>
                  <input className="field-input" value={accountForm.country} onChange={(event) => handleAccountFormChange("country", event.target.value)} placeholder="CN / HK / US / CH" />
                </label>

                <label className="wide">
                  <span>Notes</span>
                  <textarea className="field-input" rows={3} value={accountForm.notes} onChange={(event) => handleAccountFormChange("notes", event.target.value)} placeholder="Optional notes" />
                </label>

                <div className="form-actions wide">
                  <button className="primary-btn" type="submit">
                    Save Account
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetAccountForm}>
                    Reset Form
                  </button>
                </div>
              </form>
            </div>

            <div className="surface-card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Default Currency</th>
                      <th>Country / Region</th>
                      <th>Current Asset Value</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!snapshot.accounts.length ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No accounts yet.
                        </td>
                      </tr>
                    ) : (
                      snapshot.accounts
                        .slice()
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .map((account) => (
                          <tr key={account.id}>
                            <td>{account.name}</td>
                            <td>{accountTypeLabel(account.type)}</td>
                            <td>{account.defaultCurrency}</td>
                            <td>{account.country || "-"}</td>
                            <td>{formatMoney(accountValueMap[account.id] || 0, valuation.baseCurrency, snapshot.settings.locale)}</td>
                            <td>{account.notes || "-"}</td>
                            <td>
                              <div className="row-actions">
                                <button className="table-action" type="button" onClick={() => editAccount(account.id)}>
                                  Edit
                                </button>
                                <button className="table-action" type="button" onClick={() => deleteAccount(account.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function DonutCard({
  series,
  baseCurrency,
  locale,
  label,
}: {
  series: SeriesEntry[];
  baseCurrency: string;
  locale: string;
  label: string;
}) {
  if (!series.length) {
    return <div className="empty-state">No data available yet.</div>;
  }

  const total = series.reduce((sum, item) => sum + item.value, 0);
  let current = 0;
  const coloredSeries = series.map((item, index) => {
    const start = current;
    const share = total > 0 ? item.value / total : 0;
    const end = current + share * 100;
    current = end;
    return {
      ...item,
      color: COLOR_PALETTE[index % COLOR_PALETTE.length],
      stop: `${COLOR_PALETTE[index % COLOR_PALETTE.length]} ${start}% ${end}%`,
    };
  });

  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${coloredSeries.map((item) => item.stop).join(", ")})` }}>
        <div className="donut-center">
          <div>
            <span className="muted">{label}</span>
            <br />
            <strong>{formatMoney(total, baseCurrency, locale)}</strong>
          </div>
        </div>
      </div>

      <div className="legend">
        {coloredSeries.map((item) => (
          <div key={item.key} className="legend-item">
            <span className="swatch" style={{ background: item.color }} />
            <div>
              <div className="legend-main">{item.name}</div>
              <div className="legend-sub">{formatMoney(item.value, baseCurrency, locale)}</div>
            </div>
            <strong>{formatShare(total > 0 ? item.value / total : 0, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarsCard({
  items,
  baseCurrency,
  locale,
}: {
  items: Array<{ name: string; value: number; share: number }>;
  baseCurrency: string;
  locale: string;
}) {
  if (!items.length) {
    return <div className="empty-state">No ranking data available yet.</div>;
  }

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div key={item.name} className="bar-row">
          <div className="bar-meta">
            <strong>{item.name}</strong>
            <span>
              {formatMoney(item.value, baseCurrency, locale)} · {formatShare(item.share, locale)}
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(item.share * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
