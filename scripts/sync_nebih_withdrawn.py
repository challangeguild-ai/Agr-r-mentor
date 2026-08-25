#!/usr/bin/env python3
import csv
import html
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_URL = "https://portal.nebih.gov.hu/visszavont-es-lejart-ervenyessegu-novenyvedo-szerek"
OUT_DIR = Path("data/official/nebih")
OUT_CSV = OUT_DIR / "withdrawn_products.csv"
OUT_META = OUT_DIR / "metadata.txt"

MONTHS = {
    "január": 1, "február": 2, "március": 3, "április": 4,
    "május": 5, "június": 6, "július": 7, "augusztus": 8,
    "szeptember": 9, "október": 10, "november": 11, "december": 12,
}

BAD_MARKERS = (
    "maxhidefiltersindex", "showexpansion", "colheaders", "function(",
    "javascript", "<script", "var ", "push("
)

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_tr = False
        self.in_cell = False
        self.cell = []
        self.row = []
        self.rows = []
    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.in_tr = True
            self.row = []
        elif self.in_tr and tag in ("td", "th"):
            self.in_cell = True
            self.cell = []
    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)
    def handle_endtag(self, tag):
        if self.in_tr and tag in ("td", "th") and self.in_cell:
            text = re.sub(r"\s+", " ", html.unescape("".join(self.cell))).strip()
            self.row.append(text)
            self.in_cell = False
        elif tag == "tr" and self.in_tr:
            if len(self.row) >= 5:
                self.rows.append(self.row[:5])
            self.in_tr = False


def parse_hu_date(text):
    s = re.sub(r"\s+", " ", text.strip().lower())
    m = re.search(r"(20\d{2})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})", s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date().isoformat()
        except ValueError:
            return ""
    m = re.search(r"(20\d{2})\.\s*([a-záéíóöőúüű]+)\s+(\d{1,2})", s)
    if m and m.group(2) in MONTHS:
        try:
            return datetime(int(m.group(1)), MONTHS[m.group(2)], int(m.group(3))).date().isoformat()
        except ValueError:
            return ""
    return ""


def contaminated(*values):
    joined = " ".join(values).casefold()
    return any(marker in joined for marker in BAD_MARKERS)


def status_for(grace_text, grace_date, now_date):
    low = grace_text.lower()
    if grace_date:
        return "withdrawn_grace" if grace_date >= now_date else "not_applicable"
    if "nincs" in low:
        return "not_applicable"
    return "unknown"


def main():
    req = Request(SOURCE_URL, headers={"User-Agent": "Agrar-Mentor/1.0 official-source-snapshot"})
    with urlopen(req, timeout=45) as r:
        raw = r.read()
        charset = r.headers.get_content_charset() or "utf-8"
    text = raw.decode(charset, errors="replace")
    parser = TableParser()
    parser.feed(text)
    rows = []
    seen = set()
    rejected = 0
    today = datetime.now(timezone.utc).date().isoformat()
    snapshot_at = datetime.now(timezone.utc).isoformat()
    for row in parser.rows:
        name, permit_type, permit_validity, sales_grace, use_grace = [x.strip() for x in row]
        if not name or name.casefold() == "készítmény neve":
            continue
        if contaminated(name, permit_type, permit_validity, sales_grace, use_grace):
            rejected += 1
            continue
        if len(name) > 250:
            rejected += 1
            continue
        key = (name.casefold(), permit_type.casefold(), permit_validity.casefold(), use_grace.casefold())
        if key in seen:
            continue
        seen.add(key)
        withdrawal = parse_hu_date(permit_validity)
        grace = parse_hu_date(use_grace)
        status = status_for(use_grace, grace, today)
        rows.append({
            "name": name,
            "country_code": "HU",
            "regulatory_status": status,
            "withdrawal_effective_at": withdrawal,
            "grace_period_until": grace,
            "status_note": f"Nébih visszavont/lejárt lista; engedély típusa: {permit_type}; engedély érvényessége: {permit_validity}; kereskedelmi türelmi idő: {sales_grace}; felhasználási türelmi idő: {use_grace}",
            "source_url": SOURCE_URL,
            "source_snapshot_at": snapshot_at,
            "source_grace_text": use_grace,
            "source_permit_type": permit_type,
        })
    if len(rows) < 50:
        raise SystemExit(f"Gyanúsan kevés Nébih sor: {len(rows)}")
    if any(contaminated(*(str(v) for v in row.values())) for row in rows):
        raise SystemExit("Nébih snapshot validációs hiba: HTML/JavaScript szennyeződés maradt az adatokban")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys())
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    OUT_META.write_text(
        f"source=NEBIH withdrawn and expired products\nsource_url={SOURCE_URL}\ndownloaded_at={snapshot_at}\nrows={len(rows)}\nrejected_contaminated_rows={rejected}\nbytes={len(raw)}\n",
        encoding="utf-8",
    )
    print(f"Nébih snapshot: {len(rows)} tiszta sor; elutasítva: {rejected}")

if __name__ == "__main__":
    main()
