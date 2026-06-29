#!/usr/bin/env python3
"""
Fetch the 2026 PA trout stocking schedule from fbweb.pa.gov/TroutStocking
and save to data/pa-schedule-2026.json.

Run from the repo root:
    python scripts/fetch-pa-schedule.py

Re-run at the start of each stocking season or after PFBC updates the schedule.
Output: data/pa-schedule-2026.json
"""

import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

BASE_URL = "https://fbweb.pa.gov/TroutStocking"
OUT_PATH = Path(__file__).parent.parent / "data" / "pa-schedule-2026.json"

HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Referer":      BASE_URL,
    "User-Agent":   "Mozilla/5.0 (compatible; FishStockingAlert/1.0)",
}


def get_counties():
    url = BASE_URL + "/Home/GetCountyBySeason?intputSelectedSeasons="
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return [c["County"] for c in json.loads(r.read().decode())]


def fetch_county(county):
    body = json.dumps({
        "County":     county,
        "StartDate":  "",
        "EndDate":    "",
        "PageNumber": "",
        "Water":      "",
        "Season":     "",
    }).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL + "/Home/Secondpage",
        data=body,
        headers=HEADERS,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_county_html(html, county):
    """
    Each stocking record lives in a <div class="...stocksDiv..."> block.
    Inner text has the shape:
      WaterName,SecNum  [Date:|WeekOf:]MM-DD-YYYY  ...Species Stocked: SpeciesName
    Returns list of dicts: {waterName, secNum, county, date, dateIsApproximate, species}
    """
    records = []

    # Grab each stocksDiv block
    blocks = re.findall(
        r'<div[^>]+stocksDiv[^>]*>(.*?)</div>\s*</div>',
        html,
        re.DOTALL,
    )

    for block in blocks:
        text = re.sub(r'<[^>]+>', ' ', block)
        text = re.sub(r'\s+', ' ', text).strip()

        # Water name + section number: "Some Creek Name,3 Date:..."
        m_water = re.match(r'^(.*?),(\d+)\s+', text)
        if not m_water:
            continue
        water_name = m_water.group(1).strip()
        sec_num_str = m_water.group(2).strip()
        try:
            sec_num = int(sec_num_str)
        except ValueError:
            sec_num = None

        # Date — either "Date:MM-DD-YYYY" or "WeekOf:MM-DD-YYYY"
        m_date = re.search(r'(Date|WeekOf):(\d{2}-\d{2}-\d{4})', text)
        if not m_date:
            continue
        date_type = m_date.group(1)       # "Date" or "WeekOf"
        date_raw  = m_date.group(2)       # "03-14-2026"

        # Normalize to YYYY-MM-DD
        parts = date_raw.split('-')       # [MM, DD, YYYY]
        date_iso = f"{parts[2]}-{parts[0]}-{parts[1]}"
        date_approx = (date_type == "WeekOf")

        # Species
        m_species = re.search(r'Species Stocked:\s*([A-Za-z ]+?)(?:\s+Image|\s*$)', text)
        species = m_species.group(1).strip() if m_species else None

        records.append({
            "waterName":        water_name,
            "secNum":           sec_num,
            "county":           county,
            "date":             date_iso,
            "dateIsApproximate": date_approx,
            "species":          species,
        })

    return records


def main():
    print("Fetching county list…")
    counties = get_counties()
    print(f"  {len(counties)} counties found")

    all_records   = []
    county_counts = {}
    failed        = []

    for i, county in enumerate(counties, 1):
        try:
            html    = fetch_county(county)
            records = parse_county_html(html, county)
            all_records.extend(records)
            county_counts[county] = len(records)
            print(f"  [{i:2d}/{len(counties)}] {county:<20s} {len(records):3d} records")
        except Exception as e:
            print(f"  [{i:2d}/{len(counties)}] {county:<20s} FAILED: {e}")
            failed.append(county)
            county_counts[county] = 0
        # Be polite — 150 ms between requests
        time.sleep(0.15)

    OUT_PATH.write_text(
        json.dumps(all_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    exact  = sum(1 for r in all_records if not r["dateIsApproximate"])
    approx = sum(1 for r in all_records if r["dateIsApproximate"])
    dates  = sorted(r["date"] for r in all_records if r["date"])

    print(f"\nTotal records : {len(all_records)}")
    print(f"Exact dates   : {exact}")
    print(f'WeekOf approx : {approx}')
    print(f"Date range    : {dates[0]} → {dates[-1]}" if dates else "No dates")
    print(f"Failed counties: {failed if failed else 'none'}")
    print(f"\nSaved → {OUT_PATH}")


if __name__ == "__main__":
    main()
