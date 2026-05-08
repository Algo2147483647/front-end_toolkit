from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from .audit import write_audit_event
from .providers.gold_sources import load_gold_source
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
    selected_methods = _normalize_methods(methods)
    full_frame = _load_backfill_frame(source.file_path)
    window_frame = _limit_frame(full_frame, start_date, end_date)
    target_recent_business_date = _recent_business_date()

    changes: list[dict[str, Any]] = []
    repaired_window = window_frame.copy()

    if "flat_fx_ohlc" in selected_methods:
        repaired_window, flat_changes = _flat_fill_fx_ohlc(source, repaired_window)
        changes.extend(flat_changes)

    if "fx_forward_fill" in selected_methods:
        repaired_window, forward_changes = _forward_fill_fx_missing_dates(source, repaired_window)
        changes.extend(forward_changes)

    if "fx_extend_to_recent" in selected_methods:
        repaired_window, extend_changes = _extend_fx_to_recent_business_date(
            source,
            repaired_window,
            target_recent_business_date,
        )
        changes.extend(extend_changes)

    provider_status = None
    if "gold_source_backfill" in selected_methods:
        repaired_window, gold_changes, provider_status = _backfill_gold_from_source(
            source,
            repaired_window,
            target_recent_business_date,
        )
        changes.extend(gold_changes)

    unsupported_methods = selected_methods.difference(
        {"flat_fx_ohlc", "fx_forward_fill", "fx_extend_to_recent", "gold_source_backfill"}
    )
    if unsupported_methods:
        raise AssetQueryError(f"Unsupported backfill methods: {', '.join(sorted(unsupported_methods))}.")

    result = {
        "asset_type": source.asset_type,
        "file_path": str(source.file_path),
        "dry_run": bool(dry_run),
        "methods": sorted(selected_methods),
        "target_recent_business_date": target_recent_business_date.strftime("%Y-%m-%d"),
        "provider_status": provider_status,
        "change_count": len(changes),
        "changes": changes[:500],
        "truncated_changes": max(0, len(changes) - 500),
    }

    if not dry_run and changes:
        backup_path = _backup_file(source.file_path)
        repaired = _merge_repaired_window(full_frame, repaired_window, start_date, end_date)
        _write_curated_csv(source.file_path, repaired)
        refresh_asset_sources()
        result["backup_path"] = str(backup_path)

    result["validation_after"] = validate_asset_table(source.asset_type) if not dry_run and changes else None
    write_audit_event("data_backfill", result)
    return result


def _normalize_methods(methods: list[str] | str | None) -> set[str]:
    if methods is None:
        return {"flat_fx_ohlc", "fx_forward_fill", "fx_extend_to_recent"}
    if isinstance(methods, str):
        return {methods}
    return {str(method) for method in methods}


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


def _merge_repaired_window(
    full_frame: pd.DataFrame,
    repaired_window: pd.DataFrame,
    start_date: str | None,
    end_date: str | None,
) -> pd.DataFrame:
    window_mask = pd.Series(True, index=full_frame.index)
    if start_date:
        window_mask &= full_frame["date"] >= pd.to_datetime(start_date)
    if end_date:
        window_mask &= full_frame["date"] <= pd.to_datetime(end_date)

    outside = full_frame.loc[~window_mask]
    return pd.concat([outside, repaired_window], ignore_index=True).sort_values("date").drop_duplicates("date", keep="last")


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


def _extend_fx_to_recent_business_date(source, frame: pd.DataFrame, target_date: pd.Timestamp) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    if not _is_fx_source(source) or frame.empty:
        return frame, []

    repaired = frame.sort_values("date").reset_index(drop=True)
    last_date = pd.to_datetime(repaired["date"]).max()
    if pd.isna(last_date) or last_date >= target_date:
        return repaired, []

    fill_dates = pd.bdate_range(last_date + pd.offsets.BDay(1), target_date)
    if fill_dates.empty:
        return repaired, []

    previous_row = repaired.iloc[-1]
    previous_close = previous_row["close"]
    rows: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []

    for fill_date in fill_dates:
        row = {column: previous_row.get(column, pd.NA) for column in repaired.columns}
        row.update(
            {
                "date": fill_date,
                "open": previous_close,
                "high": previous_close,
                "low": previous_close,
                "close": previous_close,
                "adjusted_close": pd.NA,
                "volume": pd.NA,
                "source": "filled: fx_extend_to_recent from previous business close",
            }
        )
        rows.append(row)
        changes.append(
            {
                "date": fill_date.strftime("%Y-%m-%d"),
                "field": "row",
                "old_value": None,
                "new_value": {
                    "open": _round(previous_close),
                    "high": _round(previous_close),
                    "low": _round(previous_close),
                    "close": _round(previous_close),
                },
                "method": "fx_extend_to_recent",
                "source": "previous_business_close",
            }
        )

    extended = pd.concat([repaired, pd.DataFrame(rows)], ignore_index=True)
    return extended.sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True), changes


def _backfill_gold_from_source(source, frame: pd.DataFrame, target_date: pd.Timestamp) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    if source.base_symbol != "GOLD" or frame.empty:
        return frame, [], {"provider": None, "status": "Not a gold source."}

    provider = load_gold_source()
    provider_status = {
        "provider": provider.provider,
        "status": provider.status,
        "source_ref": provider.source_ref,
    }
    if provider.frame.empty:
        return frame, [], provider_status

    repaired = frame.sort_values("date").reset_index(drop=True)
    last_date = pd.to_datetime(repaired["date"]).max()
    candidates = provider.frame.loc[(provider.frame["date"] > last_date) & (provider.frame["date"] <= target_date)]
    if candidates.empty:
        provider_status["status"] = f"{provider.status} No rows newer than {last_date.strftime('%Y-%m-%d')} up to {target_date.strftime('%Y-%m-%d')}."
        return repaired, [], provider_status

    rows = candidates.copy()
    rows["source"] = f"{provider.provider}: licensed_source_backfill"
    changes = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "field": "row",
            "old_value": None,
            "new_value": {
                "open": _round(row["open"]),
                "high": _round(row["high"]),
                "low": _round(row["low"]),
                "close": _round(row["close"]),
            },
            "method": "gold_source_backfill",
            "source": provider.provider,
        }
        for _, row in rows.iterrows()
    ]

    merged = pd.concat([repaired, rows], ignore_index=True)
    merged = merged.sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True)
    provider_status["status"] = f"{provider.status} Applied {len(changes)} gold rows."
    return merged, changes, provider_status


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


def _recent_business_date(now: datetime | None = None) -> pd.Timestamp:
    current = pd.Timestamp((now or datetime.now()).date())
    if current.weekday() >= 5:
        return current - pd.offsets.BDay(1)
    return current
