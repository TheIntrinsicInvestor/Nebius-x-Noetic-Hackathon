import json
import os
from pathlib import Path

from api.models import BudgetQuarter, CovenantSet, Quarter

DATA = Path(__file__).resolve().parent.parent / "data"
# writable state (uploads, caches): a mounted volume when hosted, data/ locally
STATE = Path(os.environ.get("HEADROOM_STATE", DATA))
UPLOADS = STATE / "uploads"

META = {
    "nortech": {"name": "nortech", "display_name": "Nortech Systems Inc.", "currency": "$", "unit": "m",
                "as_of": "2024-09-30", "sector": "electronics manufacturing", "country": "United States",
                "lender": "Bank of America", "base_rate": "Term SOFR",
                "description": "US electronics manufacturer, ~$120m revenue, one bank lender (Bank of America), "
                               "no PE sponsor. Real SEC filings, rewound to Q3 2024 when leverage looked fine."},
    "sample_uk": {"name": "sample_uk", "display_name": "Ashby & Rowe Engineering Ltd", "currency": "£", "unit": "m",
                  "sector": "engineering manufacturing", "country": "UK", "lender": "UK high street banks",
                  "base_rate": "SONIA",
                  "description": "Fictional family-owned UK manufacturer, ~£40m revenue, RCF + term loan."},
}


def load_case(name: str, full: bool = False) -> tuple[list[Quarter], CovenantSet, dict]:
    """full=False cuts history at the case's as_of date (the demo's 'today')."""
    if name in META:
        d, meta = DATA / name, META[name]
    elif name.startswith("u-") and (UPLOADS / name / "meta.json").exists():
        d = UPLOADS / name
        meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    else:
        raise KeyError(name)
    qs = [Quarter(**q) for q in json.loads((d / "quarters.json").read_text(encoding="utf-8"))]
    cs = CovenantSet.model_validate_json((d / "covenants.json").read_text(encoding="utf-8"))
    as_of = meta.get("as_of")
    if as_of and not full:
        qs = [q for q in qs if q.period_end.isoformat() <= as_of]
    return qs, cs, meta


def load_budget(name: str) -> list[BudgetQuarter] | None:
    """The finance team's uploaded budget, if any (uploaded companies only)."""
    p = UPLOADS / name / "budget.json"
    if not name.startswith("u-") or not p.exists():
        return None
    return [BudgetQuarter(**b) for b in json.loads(p.read_text(encoding="utf-8"))]
