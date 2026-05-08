from __future__ import annotations

import os

from flask import Flask, jsonify, request

from .audit import read_audit_events, write_audit_event
from .backfill import backfill_asset_table
from .service import (
    DEFAULT_FX_RATES,
    AssetQueryError,
    get_supported_asset_types,
    list_assets,
    query_asset_history,
    refresh_asset_sources,
)
from .validators import validate_asset_table


def create_app() -> Flask:
    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/v1/assets", methods=["GET"])
    def assets():
        refresh_asset_sources()
        return jsonify({"assets": list_assets()})

    @app.route("/api/v1/fx-rates", methods=["GET"])
    def fx_rates():
        return jsonify(
            {
                "base_currency": "USD",
                "rates": DEFAULT_FX_RATES,
                "supported_price_units": sorted(DEFAULT_FX_RATES),
            }
        )

    @app.route("/api/v1/asset-history", methods=["GET", "OPTIONS"])
    def asset_history():
        if request.method == "OPTIONS":
            return ("", 204)

        try:
            refresh_asset_sources()
            payload = query_asset_history(
                asset_type=request.args.get("asset_type", ""),
                start_date=request.args.get("start_date"),
                end_date=request.args.get("end_date"),
                time_interval=request.args.get("time_interval", "1d"),
                price_unit=request.args.get("price_unit", "USD"),
            )
            return jsonify(payload)
        except AssetQueryError as error:
            return jsonify({"error": str(error), "supported_assets": get_supported_asset_types()}), 400

    @app.route("/api/v1/data/validate", methods=["POST", "OPTIONS"])
    def validate_data():
        if request.method == "OPTIONS":
            return ("", 204)

        try:
            refresh_asset_sources()
            body = request.get_json(silent=True) or {}
            asset_type = body.get("asset_type")
            if asset_type:
                payload = validate_asset_table(asset_type)
                write_audit_event("data_validate", {"asset_type": payload["asset_type"], "issue_counts": payload["issue_counts"]})
                return jsonify(payload)

            payloads = [validate_asset_table(asset["asset_type"]) for asset in list_assets()]
            summary = {
                "table_count": len(payloads),
                "error_count": sum(item["issue_counts"]["error"] for item in payloads),
                "warning_count": sum(item["issue_counts"]["warning"] for item in payloads),
                "results": payloads,
            }
            write_audit_event(
                "data_validate",
                {
                    "asset_type": "all",
                    "table_count": summary["table_count"],
                    "error_count": summary["error_count"],
                    "warning_count": summary["warning_count"],
                },
            )
            return jsonify(summary)
        except AssetQueryError as error:
            return jsonify({"error": str(error), "supported_assets": get_supported_asset_types()}), 400

    @app.route("/api/v1/data/backfill", methods=["POST", "OPTIONS"])
    def backfill_data():
        if request.method == "OPTIONS":
            return ("", 204)

        try:
            refresh_asset_sources()
            body = request.get_json(silent=True) or {}
            payload = backfill_asset_table(
                asset_type=body.get("asset_type", ""),
                start_date=body.get("start_date"),
                end_date=body.get("end_date"),
                dry_run=bool(body.get("dry_run", True)),
                methods=body.get("methods"),
            )
            return jsonify(payload)
        except AssetQueryError as error:
            return jsonify({"error": str(error), "supported_assets": get_supported_asset_types()}), 400

    @app.route("/api/v1/data/audit", methods=["GET", "OPTIONS"])
    def data_audit():
        if request.method == "OPTIONS":
            return ("", 204)
        return jsonify({"events": read_audit_events(request.args.get("limit", 100, type=int))})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("ASSET_API_PORT", "8010")), debug=True)
