#!/usr/bin/env python3
import csv
import re
import sys
from pathlib import Path

PATH = Path("data/official/nebih/withdrawn_products.csv")
VALID = {"withdrawn_grace", "not_applicable", "unknown"}

with PATH.open(encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))

errors = []
if len(rows) < 50:
    errors.append(f"Gyanúsan kevés rekord: {len(rows)}")

bad_names = []
for i, row in enumerate(rows, start=2):
    name = (row.get("name") or "").strip()
    status = (row.get("regulatory_status") or "").strip()
    if not name:
        errors.append(f"Üres készítménynév a(z) {i}. sorban")
    if status not in VALID:
        errors.append(f"Érvénytelen státusz a(z) {i}. sorban: {status!r}")
    low = name.casefold()
    if ("maxhidefiltersindex" in low or "showexpansion" in low or "colheaders" in low
            or "function" in low or "var " in low or len(name) > 250):
        bad_names.append((i, name[:120]))

if bad_names:
    errors.append("HTML/JavaScript szennyeződés került a készítménynevek közé: " + "; ".join(f"{i}: {n}" for i, n in bad_names[:5]))

if errors:
    print("Nébih snapshot VALIDÁCIÓS HIBA:")
    for e in errors:
        print("-", e)
    sys.exit(1)

print(f"Nébih snapshot rendben: {len(rows)} rekord")
