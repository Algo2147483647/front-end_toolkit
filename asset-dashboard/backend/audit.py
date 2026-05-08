from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .service import ROOT_DIR


AUDIT_DIR = ROOT_DIR / "database" / "audit"
AUDIT_LOG_PATH = AUDIT_DIR / "data_quality_audit.jsonl"


def write_audit_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    event = {
        "event_type": event_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
    with AUDIT_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=True) + "\n")
    return event


def read_audit_events(limit: int = 100) -> list[dict[str, Any]]:
    if not AUDIT_LOG_PATH.exists():
        return []

    safe_limit = max(1, min(int(limit or 100), 1000))
    lines = AUDIT_LOG_PATH.read_text(encoding="utf-8").splitlines()
    events: list[dict[str, Any]] = []
    for line in lines[-safe_limit:]:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            events.append({"event_type": "corrupt_audit_line", "raw": line})
    return events
