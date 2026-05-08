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

Example query:

```text
GET http://127.0.0.1:8000/api/v1/asset-history?asset_type=gold&start_date=1985-10-01&end_date=1985-12-31&time_interval=1w&price_unit=USD
```

Available helper endpoints:

- `GET /health`
- `GET /api/v1/assets`
- `GET /api/v1/fx-rates`
- `GET /api/v1/asset-history`
