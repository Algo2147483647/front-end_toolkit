from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from .audit import write_audit_event
from .service import AssetQueryError, _normalize_column_name, refresh_asset_sources, resolve_asset_source
from .validators import validate_asset_table


BACKUP_DIR_NAME = "backups"
PRICE_COLUMNS = ["open", "high", "low", "close"]


def backfill_asset_table(
    asset_type: str,
    start_date: str | None = None,
    end_date: str | None = None,
    dry_run: bool = True,
    methods: list[str] | None = None,
) -> dict[str, Any]:
    source = resolve_asset_source(asset_type)
    selected_methods = set(methods or ["flat_fx_ohlc", "fx_forward_fill"])
    frame = _load_backfill_frame(source.file_path)
    frame = _limit_frame(frame, start_date, end_date)

    changes: list[dict[str, Any]] = []
    repaired = frame.copy()

    if "flat_fx_ohlc" in selected_methods:
        repaired, flat_changes = _flat_fill_fx_ohlc(source, repaired)
        changes.extend(flat_changes)

    if "fx_forward_fill" in selected_methods:
        repaired, forward_changes = _forward_fill_fx_missing_dates(source, repaired)
        changes.extend(forward_changes)

    unsupported_methods = selected_methods.difference({"flat_fx_ohlc", "fx_forward_fill"})
    if unsupported_methods:
        raise AssetQueryError(f"Unsupported backfill methods: {', '.join(sorted(unsupported_methods))}.")

    result = {
        "asset_type": source.asset_type,
        "file_path": str(source.file_path),
        "dry_run": bool(dry_run),
        "methods": sorted(selected_methods),
        "change_count": len(changes),
        "changes": changes[:500],
        "truncated_changes": max(0, len(changes) - 500),
    }

    if not dry_run and changes:
        backup_path = _backup_file(source.file_path)
        _write_curated_csv(source.file_path, repaired)
        refresh_asset_sources()
        result["backup_path"] = str(backup_path)

    result["validation_after"] = validate_asset_table(source.asset_type) if not dry_run and changes else None
    write_audit_event("data_backfill", result)
    return result


def _limit_frame(frame: pd.DataFrame, start_date: str | None, end_date: str | None) -> pd.DataFrame:
    limited = frame.copy()
    if start_date:
        start_ts = pd.to_datetime(start_date, errors="coerce")
        if pd.isna(start_ts):
            raise AssetQueryError(f"Invalid start_date '{start_date}'. Use YYYY-MM-DD.")
        limited = limited.loc[limited["date"] >= start_ts]
    if end_date:
        end_ts = pd.to_datetime(end_date, errors="coerce")
        if pd.isna(end_ts):
            raise AssetQueryError(f"Invalid end_date '{end_date}'. Use YYYY-MM-DD.")
        limited = limited.loc[limited["date"] <= end_ts]
    return limited.sort_values("date").reset_index(drop=True)


def _flat_fill_fx_ohlc(source, frame: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    if not _is_fx_source(source):
        return frame, []

    repaired = frame.copy()
    changes: list[dict[str, Any]] = []
    for column in ["open", "high", "low"]:
        if column not in repaired.columns:
            repaired[column] = pd.NA
        mask = repaired[column].isna() & repaired["close"].notna()
        for _, row in repaired.loc[mask].iterrows():
            changes.append(
                {
                    "date": _format_date(row["date"]),
                    "field": column,
                    "old_value": None,
                    "new_value": _round(row["close"]),
                    "method": "flat_fx_ohlc",
                    "source": "local_close",
                }
            )
        repaired.loc[mask, column] = repaired.loc[mask, "close"]
    return repaired, changes


def _forward_fill_fx_missing_dates(source, frame: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    if not _is_fx_source(source) or frame.empty:
        return frame, []

    dates = pd.to_datetime(frame["date"]).dropna().sort_values()
    expected = pd.bdate_range(dates.iloc[0], dates.iloc[-1])
    existing = pd.DatetimeIndex(dates)
    missing = expected.difference(existing)
    if missing.empty:
        return frame, []

    indexed = frame.set_index("date").sort_index()
    rows: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []
    for missing_date in missing:
        previous = indexed.loc[indexed.index < missing_date].tail(1)
        if previous.empty:
            continue
        previous_row = previous.iloc[0]
        rows.append(
            {
                "date": missing_date,
                "open": previous_row["close"],
                "high": previous_row["close"],
                "low": previous_row["close"],
                "close": previous_row["close"],
                "adjusted_close": previous_row.get("adjusted_close", pd.NA),
                "volume": previous_row.get("volume", pd.NA),
            }
        )
        changes.append(
            {
                "date": missing_date.strftime("%Y-%m-%d"),
                "field": "row",
                "old_value": None,
                "new_value": {
                    "open": _round(previous_row["close"]),
                    "high": _round(previous_row["close"]),
                    "low": _round(previous_row["close"]),
                    "close": _round(previous_row["close"]),
                },
                "method": "fx_forward_fill",
                "source": "previous_business_record",
            }
        )

    if not rows:
        return frame, []

    repaired = pd.concat([frame, pd.DataFrame(rows)], ignore_index=True)
    repaired = repaired.sort_values("date").reset_index(drop=True)
    return repaired, changes


def _is_fx_source(source) -> bool:
    return source.base_symbol != "GOLD" and source.quote_symbol == "USD"


def _backup_file(file_path: Path) -> Path:
    backup_dir = file_path.parent / BACKUP_DIR_NAME
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = backup_dir / f"{file_path.stem}.{timestamp}{file_path.suffix}"
    backup_path.write_bytes(file_path.read_bytes())
    return backup_path


def _write_curated_csv(file_path: Path, frame: pd.DataFrame) -> None:
    output = frame.copy()
    output["date"] = pd.to_datetime(output["date"]).dt.strftime("%Y-%m-%d")
    preferred_columns = ["date", "currency_pair", "open", "high", "low", "close", "adjusted_close", "volume", "source"]
    for column in preferred_columns:
        if column not in output.columns:
            output[column] = pd.NA
    extra_columns = [column for column in output.columns if column not in preferred_columns]
    output[preferred_columns + extra_columns].to_csv(file_path, index=False)


def _load_backfill_frame(file_path: Path) -> pd.DataFrame:
    frame = pd.read_csv(file_path)
    frame = frame.rename(columns={column: _normalize_column_name(column) for column in frame.columns})

    if "date" not in frame.columns or "close" not in frame.columns:
        raise AssetQueryError(f"CSV file is missing required columns: date, close ({file_path.name})")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).sort_values("date")

    for column in ["open", "high", "low", "close", "adjusted_close", "volume"]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    return frame.reset_index(drop=True)


def _round(value: Any) -> float | None:
    if pd.isna(value):
        return None
    return round(float(value), 6)


def _format_date(value: Any) -> str:
    return pd.to_datetime(value).strftime("%Y-%m-%d")
