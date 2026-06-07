# Current Net Worth Dashboard

A runnable Next.js + TypeScript + Tailwind CSS asset overview site. Users paste JSON, the server route fetches live or latest available prices through backend-only provider calls, and the UI renders a USD total plus per-asset status and valuation details.

## Run

```powershell
cd D:\Algo\Projects\front-end_toolkit\asset-dashboard
npm install
npm run dev
```

Open the local Next.js URL shown in the terminal.

## API Keys

Create `.env.local` from `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

- `GOLDAPI_KEY`: used for GoldAPI.io spot gold pricing.
- `ALPHA_VANTAGE_API_KEY`: used for U.S. stock quotes.

FX conversion uses Frankfurter's public API and does not need a key.

## JSON Shape

```json
{
  "baseCurrency": "USD",
  "assets": [
    {
      "id": "gold_001",
      "type": "gold",
      "name": "Physical Gold",
      "quantity": 120,
      "unit": "gram"
    },
    {
      "id": "cash_eur_001",
      "type": "fx",
      "name": "EUR Cash",
      "currency": "EUR",
      "quantity": 5000
    },
    {
      "id": "stock_aapl_001",
      "type": "stock_us",
      "name": "Apple Inc.",
      "symbol": "AAPL",
      "quantity": 20
    },
    {
      "id": "custom_001",
      "type": "custom",
      "name": "Private Asset",
      "quantity": 1,
      "price": 15000,
      "currency": "USD"
    }
  ]
}
```

The asset `type` union is intentionally small now: `gold`, `fx`, `stock_us`, and `custom`. New asset classes can be added by extending the server-side source adapter switch in `lib/valuation/valuation.ts`.
