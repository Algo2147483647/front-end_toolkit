from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import pandas as pd

from .service import AssetQueryError, _load_asset_frame, _load_csv_columns, resolve_asset_source


PRICE_COLUMNS = ["open", "high", "low", "close"]


@dataclass(frozen=True)
class ValidationIssue:
    severity: str
    code: str
    message: str
    date: str | None = None
    column: str | None = None
    row: int | None = None


def validate_asset_table(asset_type: str) -> dict[str, Any]:
    source = resolve_asset_source(asset_type)
    issues: list[ValidationIssue] = []

    try:
        raw_columns = _load_csv_columns(source.file_path)
    except Exception as error:
        raise AssetQueryError(f"Unable to read CSV columns for '{asset_type}': {error}") from error

    if "date" not in raw_columns:
        issues.append(ValidationIssue("error", "missing_date_column", "CSV must contain a Date column."))
    if "close" not in raw_columns:
        issues.append(ValidationIssue("error", "missing_close_column", "CSV must contain a Close column."))

    raw = pd.read_csv(source.file_path)
    normalized = raw.rename(columns={column: _normalize_for_validation(column) for column in raw.columns})

    if "date" not in normalized.columns:
        return _validation_payload(source, raw, pd.DataFrame(), issues, [])

    normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce")
    invalid_dates = normalized[normalized["date"].isna()]
    for index in invalid_dates.index[:50]:
        issues.append(ValidationIssue("error", "invalid_date", "Date cannot be parsed.", row=int(index)))

    duplicate_dates = normalized.loc[normalized["date"].notna() & normalized["date"].duplicated(), "date"]
    for value in duplicate_dates.drop_duplicates().head(50):
        issues.append(
            ValidationIssue("error", "duplicate_date", "Date appears more than once.", date=_format_date(value))
        )

    for column in PRICE_COLUMNS + ["adjusted_close", "volume"]:
        if column in normalized.columns:
            numeric = pd.to_numeric(normalized[column], errors="coerce")
            bad_values = normalized[column].notna() & numeric.isna()
            for index in normalized.loc[bad_values].index[:50]:
                issues.append(
                    ValidationIssue(
                        "error",
                        "non_numeric_value",
                        "Numeric field cannot be parsed.",
                        column=column,
                        row=int(index),
                    )
                )

    frame = _load_asset_frame(source)
    missing_ohlc = [column for column in PRICE_COLUMNS if column not in normalized.columns]
    if missing_ohlc:
        severity = "warning" if "close" in normalized.columns else "error"
        issues.append(
            ValidationIssue(
                severity,
                "missing_ohlc_columns",
                f"Missing OHLC columns: {', '.join(missing_ohlc)}. Close-only FX tables can be repaired as flat candles.",
            )
        )

    negative_mask = frame[PRICE_COLUMNS].lt(0).any(axis=1)
    for _, row in frame.loc[negative_mask].head(50).iterrows():
        issues.append(ValidationIssue("error", "negative_price", "Price values cannot be negative.", _format_date(row["date"])))

    invalid_ohlc = frame[
        (frame["high"] < frame[["open", "close"]].max(axis=1))
        | (frame["low"] > frame[["open", "close"]].min(axis=1))
        | (frame["high"] < frame["low"])
    ]
    for _, row in invalid_ohlc.head(50).iterrows():
        issues.append(ValidationIssue("error", "invalid_ohlc", "OHLC relationship is inconsistent.", _format_date(row["date"])))

    missing_dates = _find_missing_business_dates(frame)
    for value in missing_dates[:50]:
        issues.append(ValidationIssue("warning", "missing_business_date", "Expected business date is absent.", value))

    return _validation_payload(source, raw, frame, issues, missing_dates)


def _validation_payload(source, raw: pd.DataFrame, frame: pd.DataFrame, issues: list[ValidationIssue], missing_dates: list[str]):
    error_count = sum(1 for issue in issues if issue.severity == "error")
    warning_count = sum(1 for issue in issues if issue.severity == "warning")
    return {
        "asset_type": source.asset_type,
        "file_path": str(source.file_path),
        "row_count": int(len(raw)),
        "valid_row_count": int(len(frame)),
        "date_start": _format_date(frame["date"].min()) if not frame.empty else None,
        "date_end": _format_date(frame["date"].max()) if not frame.empty else None,
        "missing_business_dates": missing_dates,
        "issue_counts": {"error": error_count, "warning": warning_count},
        "issues": [asdict(issue) for issue in issues],
        "is_valid": error_count == 0,
    }


def _find_missing_business_dates(frame: pd.DataFrame) -> list[str]:
    if frame.empty:
        return []
    dates = pd.to_datetime(frame["date"]).dropna().drop_duplicates().sort_values()
    if dates.empty:
        return []
    expected = pd.bdate_range(dates.iloc[0], dates.iloc[-1])
    missing = expected.difference(pd.DatetimeIndex(dates))
    return [value.strftime("%Y-%m-%d") for value in missing]


def _normalize_for_validation(value: str) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if normalized in {"adj_close", "adjustedclose", "adjusted_close"}:
        return "adjusted_close"
    return normalized


def _format_date(value: Any) -> str | None:
    if pd.isna(value):
        return None
    return pd.to_datetime(value).strftime("%Y-%m-%d")
