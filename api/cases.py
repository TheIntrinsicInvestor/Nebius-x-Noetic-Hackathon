import json
from pathlib import Path

from api.models import CovenantSet, Quarter

DATA = Path(__file__).resolve().parent.parent / "data"

META = {
    "nortech": {"name": "nortech", "display_name": "Nortech Systems Inc.", "currency": "$", "unit": "m",
                "as_of": "2024-09-30",
                "description": "US electronics manufacturer, ~$120m revenue, one bank lender (Bank of America), "
                               "no PE sponsor. Real SEC filings, rewound to Q3 2024 when leverage looked fine."},
    "sample_uk": {"name": "sample_uk", "display_name": "Ashby & Rowe Engineering Ltd", "currency": "£", "unit": "m",
                  "description": "Fictional family-owned UK manufacturer, ~£40m revenue, RCF + term loan."},
}


def load_case(name: str, full: bool = False) -> tuple[list[Quarter], CovenantSet, dict]:
    """full=False cuts history at the case's as_of date (the demo's 'today')."""
    if name not in META:
        raise KeyError(name)
    d = DATA / name
    qs = [Quarter(**q) for q in json.loads((d / "quarters.json").read_text(encoding="utf-8"))]
    cs = CovenantSet.model_validate_json((d / "covenants.json").read_text(encoding="utf-8"))
    as_of = META[name].get("as_of")
    if as_of and not full:
        qs = [q for q in qs if q.period_end.isoformat() <= as_of]
    return qs, cs, META[name]
