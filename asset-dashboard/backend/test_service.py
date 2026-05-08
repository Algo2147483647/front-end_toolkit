import unittest

import pandas as pd

from backend.app import create_app
from backend.service import get_supported_asset_types, query_asset_history


class AssetHistoryApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.client = self.app.test_client()

    def test_asset_history_endpoint(self) -> None:
        response = self.client.get(
            "/api/v1/asset-history",
            query_string={
                "asset_type": "gold",
                "start_date": "1985-10-01",
                "end_date": "1985-10-10",
                "time_interval": "1d",
                "price_unit": "USD",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["asset_type"], "gold")
        self.assertEqual(payload["price_unit"], "USD")
        self.assertTrue(payload["records"])
        self.assertEqual(payload["records"][0]["date"], "1985-10-01")

    def test_auto_discovers_database_assets(self) -> None:
        supported = get_supported_asset_types()
        self.assertIn("gold", supported)
        self.assertIn("eur_usd", supported)
        self.assertIn("cny_usd", supported)

    def test_close_only_fx_csv_is_supported(self) -> None:
        response = self.client.get(
            "/api/v1/asset-history",
            query_string={
                "asset_type": "eur_usd",
                "start_date": "1999-01-04",
                "end_date": "1999-01-06",
                "time_interval": "1d",
                "price_unit": "USD",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["asset_type"], "eur_usd")
        self.assertEqual(payload["records"][0]["open"], payload["records"][0]["close"])
        self.assertEqual(payload["records"][0]["high"], payload["records"][0]["close"])
        self.assertEqual(payload["records"][0]["low"], payload["records"][0]["close"])

    def test_gold_jpy_uses_historical_jpy_usd_series(self) -> None:
        payload = query_asset_history(
            asset_type="gold",
            start_date="1985-10-01",
            end_date="1985-10-01",
            time_interval="1d",
            price_unit="JPY",
        )

        gold_frame = pd.read_csv("database/GOLD_USD.csv")
        jpy_frame = pd.read_csv("database/JPY_USD.csv")
        gold_close = float(gold_frame.loc[gold_frame["Date"] == "1985-10-01", "Close"].iloc[0])
        jpy_usd = float(jpy_frame.loc[jpy_frame["date"] == "1985-10-01", "close"].iloc[0])
        expected_close = round(gold_close / jpy_usd, 6)

        self.assertEqual(payload["records"][0]["date"], "1985-10-01")
        self.assertEqual(payload["records"][0]["close"], expected_close)

    def test_validate_data_endpoint_reports_table_quality(self) -> None:
        response = self.client.post("/api/v1/data/validate", json={"asset_type": "gold"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["asset_type"], "gold")
        self.assertIn("issue_counts", payload)
        self.assertIn("issues", payload)
        self.assertGreater(payload["row_count"], 0)

    def test_backfill_endpoint_supports_dry_run(self) -> None:
        response = self.client.post(
            "/api/v1/data/backfill",
            json={
                "asset_type": "jpy_usd",
                "start_date": "1971-01-04",
                "end_date": "1971-01-04",
                "dry_run": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["dry_run"])
        self.assertEqual(payload["asset_type"], "jpy_usd")
        self.assertIn("change_count", payload)
        self.assertIn("changes", payload)

    def test_audit_endpoint_returns_events(self) -> None:
        self.client.post("/api/v1/data/validate", json={"asset_type": "gold"})
        response = self.client.get("/api/v1/data/audit", query_string={"limit": 5})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("events", payload)
        self.assertTrue(payload["events"])


if __name__ == "__main__":
    unittest.main()
