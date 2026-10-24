import json
from datetime import date
from pathlib import Path

from api.engine.headroom import analyze
from api.models import CovenantSet, Quarter, Scenario

D = Path(__file__).resolve().parent.parent / "data" / "sample_uk"


def load():
    qs = [Quarter(**q) for q in json.loads((D / "quarters.json").read_text(encoding="utf-8"))]
    cs = CovenantSet.model_validate_json((D / "covenants.json").read_text(encoding="utf-8"))
    return qs, cs


def test_sample_has_no_historical_breach():
    qs, cs = load()
    hist = [p for p in analyze(qs, cs).points if not p.is_forecast]
    assert hist and not any(p.breached for p in hist)
    lev = next(c for c in cs.covenants if c.kind == "leverage")
    assert "2.50:1" in lev.source_quote and "3.25:1" in lev.source_quote


def test_sample_breaches_only_under_dso_shock():
    qs, cs = load()
    assert len(qs) == 12
    assert analyze(qs, cs).first_breach is None
    shocked = analyze(qs, cs, Scenario(dso_delta=10)).first_breach
    assert shocked is not None
    assert shocked.period_end == date(2027, 3, 31)
    assert shocked.kind == "leverage"
