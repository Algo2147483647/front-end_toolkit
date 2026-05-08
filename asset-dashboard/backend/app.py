from __future__ import annotations

from flask import Flask, jsonify, request

from .service import (
    DEFAULT_FX_RATES,
    AssetQueryError,
    get_supported_asset_types,
    list_assets,
    query_asset_history,
    refresh_asset_sources,
)


def create_app() -> Flask:
    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
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

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
