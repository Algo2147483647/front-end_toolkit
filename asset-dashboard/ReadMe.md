# Global Asset Net Worth Board

This tool is now implemented as a standalone React + TypeScript + Vite app inside [asset-dashboard](/D:/Algo/Projects/front-end_toolkit/asset-dashboard).

## Product Scope

This board is intentionally narrow:

- No transaction history
- No historical P&amp;L
- No cost basis
- No dividend ledger
- No tax logic

It only answers:

- How much do I have right now?
- Where is it held?
- What currency exposure do I have?
- Which assets or currencies are too concentrated?

## FX Base

- FX storage now uses `USD` as the exchange base
- each FX row means `1 USD = N units of target currency`
- the app can refresh latest online FX from Frankfurter's public API
- source note: Frankfurter publishes the latest available official working-day rates, not tick-level market data

## Architecture

- [src/App.tsx](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/src/App.tsx): main React UI
- [src/portfolio.ts](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/src/portfolio.ts): snapshot normalization, valuation, import/export helpers
- [src/types.ts](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/src/types.ts): TypeScript domain types
- [sample-data.json](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/sample-data.json): sample snapshot
- [asset-snapshot.schema.json](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/asset-snapshot.schema.json): JSON schema draft

## Data Model

The recommended JSON shape separates four collections:

1. `accounts`
2. `fxRates`
3. `quotes`
4. `assets`

That keeps quote maintenance clean:

- one FX rate per currency
- one quote per priced instrument
- one asset record per current holding

## Valuation Logic

```text
cash market value = amount
quoted asset market value = quantity × current quote
converted value = market value ÷ rateFromUsd(source currency) × rateFromUsd(base currency)
weight = converted value ÷ total net worth
```

## Run Locally

```powershell
cd D:\Algo\Projects\front-end_toolkit\asset-dashboard
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Build

```powershell
cd D:\Algo\Projects\front-end_toolkit\asset-dashboard
npm run build
```

## Python Backend

The repo now also includes a lightweight Python historical-price API in [backend/app.py](/D:/Algo/Projects/front-end_toolkit/asset-dashboard/backend/app.py).

Run it locally:

```powershell
cd D:\Algo\Projects\front-end_toolkit\asset-dashboard
python -m backend.app
```

The frontend dev server proxies `/api/*` to `http://127.0.0.1:8010`, so the browser can call the backend through the same Vite origin during local development.

Example query:

```text
GET http://127.0.0.1:8010/api/v1/asset-history?asset_type=gold&start_date=1985-10-01&end_date=1985-12-31&time_interval=1w&price_unit=USD
```

Available helper endpoints:

- `GET /health`
- `GET /api/v1/assets`
- `GET /api/v1/fx-rates`
- `GET /api/v1/asset-history`
- `POST /api/v1/data/validate`
- `POST /api/v1/data/backfill`
- `GET /api/v1/data/audit`

Validate one table:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8010/api/v1/data/validate `
  -ContentType application/json `
  -Body '{"asset_type":"gold"}'
```

Preview a repair without writing the CSV:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8010/api/v1/data/backfill `
  -ContentType application/json `
  -Body '{"asset_type":"jpy_usd","start_date":"1971-01-04","end_date":"1971-01-08","dry_run":true}'
```

Backfill is conservative by design. FX tables can repair missing OHLC fields from `close` and fill missing business dates with the previous available close. Gold and index OHLCV gaps are reported for source-based backfill instead of being interpolated. Real write operations create a CSV backup under `database/backups/` and append an audit event under `database/audit/data_quality_audit.jsonl`.

To extend FX tables to today or the nearest previous business day:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8010/api/v1/data/backfill `
  -ContentType application/json `
  -Body '{"asset_type":"jpy_usd","dry_run":false,"methods":["fx_extend_to_recent"]}'
```

`fx_extend_to_recent` uses the previous available business close for generated FX candles. It does not synthesize gold or index OHLCV data.

Gold source backfill supports licensed CME/LBMA exports:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8010/api/v1/data/backfill `
  -ContentType application/json `
  -Body '{"asset_type":"gold","dry_run":false,"methods":["gold_source_backfill"]}'
```

The backend looks for these local files by default:

- `database/sources/cme_gold.csv`
- `database/sources/lbma_gold.csv`

You can also point it at an authorized CSV URL or local file:

```powershell
$env:GOLD_CME_SOURCE="D:\licensed-data\cme_gold.csv"
$env:GOLD_LBMA_SOURCE="D:\licensed-data\lbma_gold.csv"
```

CME exports should contain a date column and a close-like field such as `settle`, `settlement`, `last`, or `close`; optional `open/high/low/volume` columns are used when available. LBMA exports should contain a date column and a PM price field such as `usd_pm`, `pm_usd`, `pm`, `price`, or `close`. LBMA close-only rows are loaded as flat OHLC candles because the LBMA benchmark is a twice-daily benchmark, not an exchange OHLCV bar.
