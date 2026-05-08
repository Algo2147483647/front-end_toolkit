from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
DATABASE_DIR = ROOT_DIR / "database"

SUPPORTED_INTERVALS = {"1d", "1w", "1m"}
SUPPORTED_PRICE_UNITS = {"USD", "EUR", "CNY", "JPY", "HKD"}

# Spot conversion table using USD as base.
# 1 USD = N target units.
DEFAULT_FX_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "CNY": 7.23,
    "JPY": 155.4,
    "HKD": 7.82,
}


@dataclass(frozen=True)
class AssetSource:
    asset_type: str
    label: str
    file_path: Path
    native_currency: str
    aliases: tuple[str, ...]
    base_symbol: str
    quote_symbol: str


class AssetQueryError(ValueError):
    pass


def list_assets() -> list[dict[str, Any]]:
    return [
        {
            "asset_type": source.asset_type,
            "label": source.label,
            "native_currency": source.native_currency,
            "file_path": str(source.file_path),
            "aliases": list(source.aliases),
        }
        for source in discover_asset_sources()
    ]


def get_supported_asset_types() -> list[str]:
    values: set[str] = set()
    for source in discover_asset_sources():
        values.update(source.aliases)
    return sorted(values)


def query_asset_history(
    asset_type: str,
    start_date: str | None,
    end_date: str | None,
    time_interval: str,
    price_unit: str,
) -> dict[str, Any]:
    source = resolve_asset_source(asset_type)

    normalized_interval = str(time_interval or "1d").strip().lower()
    if normalized_interval not in SUPPORTED_INTERVALS:
        supported = ", ".join(sorted(SUPPORTED_INTERVALS))
        raise AssetQueryError(f"Unsupported time_interval '{time_interval}'. Supported values: {supported}.")

    normalized_price_unit = str(price_unit or "USD").strip().upper()
    if normalized_price_unit not in SUPPORTED_PRICE_UNITS:
        supported = ", ".join(sorted(SUPPORTED_PRICE_UNITS))
        raise AssetQueryError(f"Unsupported price_unit '{price_unit}'. Supported values: {supported}.")

    frame = _load_asset_frame(source)
    filtered = _filter_date_range(frame, start_date, end_date)
    converted_daily = _convert_prices_historically(filtered, source.native_currency, normalized_price_unit)
    converted = _resample_frame(converted_daily, normalized_interval)

    if converted.empty:
        return {
            "asset_type": source.asset_type,
            "price_unit": normalized_price_unit,
            "source_currency": source.native_currency,
            "interval": normalized_interval,
            "start_time": start_date,
            "end_time": end_date,
            "records": [],
        }

    records = [_row_to_record(row) for _, row in converted.iterrows()]
    return {
        "asset_type": source.asset_type,
        "price_unit": normalized_price_unit,
        "source_currency": source.native_currency,
        "interval": normalized_interval,
        "start_time": records[0]["date"],
        "end_time": records[-1]["date"],
        "records": records,
    }


def resolve_asset_source(asset_type: str) -> AssetSource:
    normalized_asset_type = str(asset_type or "").strip().lower()
    registry = {alias: source for source in discover_asset_sources() for alias in source.aliases}
    if normalized_asset_type not in registry:
        supported = ", ".join(get_supported_asset_types())
        raise AssetQueryError(f"Unsupported asset_type '{asset_type}'. Supported values: {supported}.")
    return registry[normalized_asset_type]


@lru_cache(maxsize=1)
def discover_asset_sources() -> tuple[AssetSource, ...]:
    discovered: list[AssetSource] = []

    for file_path in sorted(DATABASE_DIR.glob("*.csv")):
        source = _build_asset_source(file_path)
        if source is not None:
            discovered.append(source)

    return tuple(discovered)


def refresh_asset_sources() -> None:
    discover_asset_sources.cache_clear()


def _build_asset_source(file_path: Path) -> AssetSource | None:
    columns = _load_csv_columns(file_path)
    if "date" not in columns or "close" not in columns:
        return None

    stem = file_path.stem.strip()
    parts = [part.upper() for part in stem.split("_") if part.strip()]
    if not parts:
        return None

    if len(parts) >= 2:
        base_symbol = parts[0]
        quote_symbol = parts[-1]
        canonical_asset_type = stem.lower()
        native_currency = quote_symbol
        aliases = {
            canonical_asset_type,
            canonical_asset_type.replace("_", "/"),
            base_symbol.lower(),
        }

        if base_symbol == "GOLD":
            aliases.add("gold")
            label = f"Gold priced in {quote_symbol}"
            canonical_asset_type = "gold"
        else:
            label = f"{base_symbol}/{quote_symbol} historical prices"
    else:
        canonical_asset_type = stem.lower()
        native_currency = "USD"
        aliases = {canonical_asset_type}
        label = f"{parts[0]} historical prices"

    return AssetSource(
        asset_type=canonical_asset_type,
        label=label,
        file_path=file_path,
        native_currency=native_currency,
        aliases=tuple(sorted(aliases)),
        base_symbol=parts[0],
        quote_symbol=parts[-1],
    )


def _load_asset_frame(source: AssetSource) -> pd.DataFrame:
    if not source.file_path.exists():
        raise AssetQueryError(f"CSV file does not exist: {source.file_path}")

    frame = pd.read_csv(source.file_path)
    normalized_columns = {column: _normalize_column_name(column) for column in frame.columns}
    frame = frame.rename(columns=normalized_columns)

    if "date" not in frame.columns or "close" not in frame.columns:
        raise AssetQueryError(f"CSV file is missing required columns: date, close ({source.file_path.name})")

    if "adjusted_close" not in frame.columns:
        frame["adjusted_close"] = pd.NA

    if "volume" not in frame.columns:
        frame["volume"] = pd.NA

    for price_column in ["open", "high", "low"]:
        if price_column not in frame.columns:
            frame[price_column] = frame["close"]

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).sort_values("date")

    for column in ["open", "high", "low", "close", "adjusted_close", "volume"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    # Many FX sources provide close-only data. Use close as a flat candle when OHLC is missing.
    for price_column in ["open", "high", "low"]:
        frame[price_column] = frame[price_column].fillna(frame["close"])

    frame = frame.dropna(subset=["open", "high", "low", "close"])
    return frame.reset_index(drop=True)


def _filter_date_range(frame: pd.DataFrame, start_date: str | None, end_date: str | None) -> pd.DataFrame:
    filtered = frame.copy()

    if start_date:
        start_ts = pd.to_datetime(start_date, errors="coerce")
        if pd.isna(start_ts):
            raise AssetQueryError(f"Invalid start_date '{start_date}'. Use YYYY-MM-DD.")
        filtered = filtered.loc[filtered["date"] >= start_ts]

    if end_date:
        end_ts = pd.to_datetime(end_date, errors="coerce")
        if pd.isna(end_ts):
            raise AssetQueryError(f"Invalid end_date '{end_date}'. Use YYYY-MM-DD.")
        filtered = filtered.loc[filtered["date"] <= end_ts]

    return filtered.reset_index(drop=True)


def _resample_frame(frame: pd.DataFrame, interval: str) -> pd.DataFrame:
    if frame.empty or interval == "1d":
        return frame.reset_index(drop=True)

    sampled = (
        frame.set_index("date")
        .resample("W-FRI" if interval == "1w" else "ME")
        .agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "adjusted_close": "last",
                "volume": "sum",
            }
        )
        .dropna(subset=["open", "high", "low", "close"])
        .reset_index()
    )
    return sampled


def _convert_prices_historically(frame: pd.DataFrame, from_currency: str, to_currency: str) -> pd.DataFrame:
    if frame.empty or from_currency == to_currency:
        return frame.reset_index(drop=True)

    converted = frame.copy()
    converted["usd_per_from"] = _build_usd_value_series(from_currency, converted["date"])
    converted["usd_per_to"] = _build_usd_value_series(to_currency, converted["date"])
    converted = converted.dropna(subset=["usd_per_from", "usd_per_to"])

    if converted.empty:
        raise AssetQueryError(
            f"No overlapping historical FX data is available to convert {from_currency} prices into {to_currency}."
        )

    factor = converted["usd_per_from"] / converted["usd_per_to"]
    for column in ["open", "high", "low", "close", "adjusted_close"]:
        converted[column] = converted[column] * factor

    return converted.drop(columns=["usd_per_from", "usd_per_to"]).reset_index(drop=True)


def _build_usd_value_series(currency: str, asset_dates: pd.Series) -> pd.Series:
    normalized_currency = str(currency).upper()
    if normalized_currency == "USD":
        return pd.Series([1.0] * len(asset_dates), index=asset_dates.index, dtype="float64")

    fx_source = _find_currency_fx_source(normalized_currency)
    if fx_source is None:
        fallback = DEFAULT_FX_RATES.get(normalized_currency)
        if fallback:
            return pd.Series([1.0 / fallback] * len(asset_dates), index=asset_dates.index, dtype="float64")
        raise AssetQueryError(f"No historical FX source is available for currency '{currency}'.")

    fx_frame = _load_asset_frame(fx_source)[["date", "close"]].rename(columns={"close": "fx_close"}).sort_values("date")
    orientation = _infer_fx_orientation(fx_frame["fx_close"], normalized_currency)

    if orientation == "usd_per_currency":
        fx_frame["usd_value"] = fx_frame["fx_close"]
    else:
        fx_frame["usd_value"] = fx_frame["fx_close"].apply(
            lambda value: 1.0 / value if pd.notna(value) and value else pd.NA
        )

    base = pd.DataFrame({"date": pd.to_datetime(asset_dates)}).sort_values("date").reset_index()
    aligned = pd.merge_asof(
        base,
        fx_frame[["date", "usd_value"]].sort_values("date"),
        on="date",
        direction="backward",
    )
    return aligned.sort_values("index")["usd_value"].reset_index(drop=True)


def _find_currency_fx_source(currency: str) -> AssetSource | None:
    normalized_currency = str(currency).upper()
    for source in discover_asset_sources():
        if source.base_symbol == normalized_currency and source.quote_symbol == "USD":
            return source
    return None


def _infer_fx_orientation(close_series: pd.Series, currency: str) -> str:
    non_null = close_series.dropna()
    if non_null.empty:
        raise AssetQueryError(f"Unable to infer FX orientation for currency '{currency}'.")

    latest_close = float(non_null.iloc[-1])
    reference = DEFAULT_FX_RATES.get(currency.upper())
    if not reference:
        return "usd_per_currency"

    direct_distance = abs(latest_close - float(reference))
    inverse_distance = abs(latest_close - (1.0 / float(reference)))
    return "currency_per_usd" if direct_distance <= inverse_distance else "usd_per_currency"


def _conversion_factor(from_currency: str, to_currency: str) -> float:
    base_from = DEFAULT_FX_RATES.get(str(from_currency).upper())
    base_to = DEFAULT_FX_RATES.get(str(to_currency).upper())
    if not base_from or not base_to:
        raise AssetQueryError(f"Unsupported currency conversion: {from_currency} -> {to_currency}")
    usd_value = 1.0 if from_currency.upper() == "USD" else 1.0 / base_from
    return usd_value if to_currency.upper() == "USD" else usd_value * base_to


def _row_to_record(row: pd.Series) -> dict[str, Any]:
    return {
        "date": row["date"].strftime("%Y-%m-%d"),
        "open": _round_or_none(row.get("open")),
        "high": _round_or_none(row.get("high")),
        "low": _round_or_none(row.get("low")),
        "close": _round_or_none(row.get("close")),
        "adjusted_close": _round_or_none(row.get("adjusted_close")),
        "volume": _int_or_none(row.get("volume")),
    }


def _round_or_none(value: Any) -> float | None:
    if pd.isna(value):
        return None
    return round(float(value), 6)


def _int_or_none(value: Any) -> int | None:
    if pd.isna(value):
        return None
    return int(float(value))


def _normalize_column_name(value: str) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if normalized in {"adj_close", "adjustedclose", "adjusted_close"}:
        return "adjusted_close"
    return normalized


def _load_csv_columns(file_path: Path) -> set[str]:
    frame = pd.read_csv(file_path, nrows=0)
    return {_normalize_column_name(column) for column in frame.columns}
