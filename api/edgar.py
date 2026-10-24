"""Quarterly financials for Nortech Systems from SEC XBRL companyfacts."""
import json
import logging
import os
from datetime import date
from pathlib import Path

import httpx
from api.env import load_env

from api.models import Quarter

load_env()
log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "nortech" / "companyfacts.json"

DURATION_TAGS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
    "cogs": ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold"],
    "ebit": ["OperatingIncomeLoss"],
    "da": ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "Depreciation"],
    "interest_expense": ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "principal_paid": ["RepaymentsOfLongTermDebt"],
}
INSTANT_TAGS = {
    "cash": ["CashAndCashEquivalentsAtCarryingValue"],
    "receivables": ["AccountsReceivableNetCurrent"],
    "inventory": ["InventoryNet"],
    "payables": ["AccountsPayableCurrent"],
}


def fetch_companyfacts(cik: int = 722313) -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
    r = httpx.get(url, headers={"User-Agent": os.environ["SEC_USER_AGENT"]}, timeout=30)
    r.raise_for_status()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(r.text, encoding="utf-8")
    return r.json()


def deaccumulate(ytd: list[float]) -> list[float]:
    return [v - (ytd[i - 1] if i else 0) for i, v in enumerate(ytd)]


def _entries(facts: dict, tag: str) -> list[dict]:
    units = facts["facts"].get("us-gaap", {}).get(tag, {}).get("units", {})
    rows = units.get("USD", [])
    latest: dict[tuple, dict] = {}  # keep the most recently filed value per period
    for r in rows:
        key = (r.get("start"), r["end"])
        if key not in latest or r["filed"] > latest[key]["filed"]:
            latest[key] = r
    return list(latest.values())


def _days(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def _quarterly(facts: dict, tag: str) -> dict[date, float]:
    """3-month values by quarter end; YTD figures are de-accumulated against the prior YTD."""
    rows = _entries(facts, tag)
    out: dict[date, float] = {}
    by_span = {(r["start"], r["end"]): r["val"] for r in rows if r.get("start")}
    for (start, end), val in by_span.items():
        if 80 <= _days(start, end) <= 100:
            out[date.fromisoformat(end)] = val
    for (start, end), val in by_span.items():
        d = date.fromisoformat(end)
        if d in out or _days(start, end) <= 100:
            continue
        prior = [(e, v) for (s, e), v in by_span.items() if s == start and 80 <= _days(end, e) * -1 <= 100]
        if prior:
            out[d] = val - prior[0][1]
    return out


def _instant(facts: dict, tag: str) -> dict[date, float]:
    return {date.fromisoformat(r["end"]): r["val"] for r in _entries(facts, tag) if not r.get("start")}


def _merged(facts: dict, tags: list[str], fn) -> dict[date, float]:
    """Per date, the value from the highest-priority tag that has one (filers switch tags over time)."""
    out: dict[date, float] = {}
    for t in reversed(tags):
        out |= fn(facts, t)
    return out


def _debt(facts: dict) -> dict[date, float]:
    revolver = _merged(facts, ["LinesOfCreditCurrent", "LongTermLineOfCredit", "LineOfCredit"], _instant)
    total = _instant(facts, "LongTermDebt")
    noncurrent = _instant(facts, "LongTermDebtNoncurrent")
    current = _instant(facts, "LongTermDebtCurrent")
    dates = set(revolver) | set(total) | set(noncurrent)
    return {d: revolver.get(d, 0.0) + total.get(d, noncurrent.get(d, 0.0) + current.get(d, 0.0))
            for d in dates}


def to_quarters(facts: dict) -> list[Quarter]:
    series = {k: _merged(facts, tags, _quarterly) for k, tags in DURATION_TAGS.items()}
    series |= {k: _merged(facts, tags, _instant) for k, tags in INSTANT_TAGS.items()}
    series["debt"] = _debt(facts)
    ends = sorted(d for d in series["revenue"] if d.year >= 2022)
    out: list[Quarter] = []
    for d in ends:
        row = {}
        for k, s in series.items():
            if d in s:
                row[k] = s[d] / 1e6  # $m
            elif out and k != "principal_paid":
                log.warning("missing %s at %s, carrying prior quarter", k, d)
                row[k] = getattr(out[-1], k)
            else:
                row[k] = 0.0
        out.append(Quarter(period_end=d, **row))
    return out
