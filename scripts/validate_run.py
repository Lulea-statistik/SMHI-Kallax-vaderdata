#!/usr/bin/env python3
"""Fail the workflow if the latest SMHI run returned implausibly little data."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "metadata" / "last_run.json"

with path.open("r", encoding="utf-8") as handle:
    run = json.load(handle)

configured = int(run.get("parameters_configured", 0))
ok = int(run.get("parameters_ok", 0))
errors = int(run.get("parameters_error", 0))
health = run.get("health", "unknown")

print(f"Run health: {health}; parameters with data: {ok}/{configured}; errors: {errors}")

if configured == 0 or ok < max(1, configured // 2):
    raise SystemExit(
        "Too few configured parameters returned data. "
        "The data commit was kept for diagnostics, but the workflow is marked failed."
    )
