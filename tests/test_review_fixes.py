"""Regression tests for the final-review findings."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.cases import load_case
from api.copilot import run_scenario_tool
from api.engine.headroom import analyze
from api.extract_agreement import to_millions
from api.main import app
from api.models import CovenantSet, Scenario

ROOT = Path(__file__).resolve().parent.parent
client = TestClient(app)


def test_extraction_scaled_to_millions():
    raw = CovenantSet.model_validate_json(
        (ROOT / "data" / "nortech" / "extracted" / "2025-05_amendment.json").read_text(encoding="utf-8"))
    cs = to_millions(raw)
    me = next(c for c in cs.covenants if c.kind == "min_ebitda")
    assert me.threshold == pytest.approx(1.0)
    assert [s.threshold for s in me.step_downs] == pytest.approx([1.3, 1.6])
    lev = next(c for c in cs.covenants if c.kind == "leverage")
    assert lev.threshold == pytest.approx(2.5)  # ratios untouched
    orig = CovenantSet.model_validate_json(
        (ROOT / "data" / "nortech" / "extracted" / "2024-03_credit_agreement.json").read_text(encoding="utf-8"))
    assert to_millions(orig).facility.size == pytest.approx(15.0)


def test_reverse_stress_is_room_left_from_current_scenario():
    qs, cs, _ = load_case("sample_uk")
    base = analyze(qs, cs).reverse_stress
    moved = analyze(qs, cs, Scenario(dso_delta=3)).reverse_stress
    assert moved["dso_days"] == pytest.approx(base["dso_days"] - 3, abs=0.6)
    moved_e = analyze(qs, cs, Scenario(ebitda_pct=-0.03)).reverse_stress
    assert moved_e["ebitda_fall_pct"] == pytest.approx(base["ebitda_fall_pct"] + 0.03, abs=0.01)


def test_zero_threshold_is_needs_input_not_500():
    body = client.get("/cases/sample_uk").json()["covenants"]
    body["covenants"][1]["threshold"] = 0
    r = client.post("/analyze", json={"case": "sample_uk", "covenants": body, "scenario": {}, "insights": False})
    assert r.status_code == 200
    assert "interest_cover" in r.json()["analysis"]["needs_input"]


def test_copilot_tool_uses_edited_covenants():
    _, cs, _ = load_case("sample_uk")
    tight = cs.model_copy(deep=True)
    tight.covenants[0].threshold = 2.0
    tight.covenants[0].step_downs = []
    r = run_scenario_tool("sample_uk", {}, tight)
    assert r["first_breach"] is not None
    assert r["lowest_headroom"]["leverage"]["limit"] == 2.0


def test_ask_endpoint_passes_covenants(monkeypatch):
    import api.main as m
    seen = {}
    monkeypatch.setattr(m, "ask", lambda case, q, cs=None: seen.update(cs=cs) or {"answer": "ok"})
    body = client.get("/cases/sample_uk").json()["covenants"]
    client.post("/ask", json={"case": "sample_uk", "question": "x", "covenants": body})
    assert seen["cs"] is not None
