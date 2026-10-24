from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_get_case_has_meta():
    r = client.get("/cases/sample_uk")
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["currency"] == "£"
    assert len(body["quarters"]) == 12


def test_nortech_case_rewinds_to_q3_2024():
    body = client.get("/cases/nortech").json()
    assert body["meta"]["as_of"] == "2024-09-30"
    assert body["quarters"][-1]["period_end"] == "2024-09-30"
    a = client.post("/analyze", json={"case": "nortech", "scenario": {}, "insights": False}).json()["analysis"]
    assert a["first_breach"]["kind"] == "leverage"


def test_insight_payload_omits_default_scenario_and_has_glossary():
    from api.cases import load_case
    from api.engine.headroom import analyze
    from api.main import insight_payload
    from api.models import Scenario
    qs, cs, meta = load_case("sample_uk")
    p = insight_payload(analyze(qs, cs), meta, Scenario())
    assert "scenario" not in p
    assert "EBITDA / interest" in p["definitions"]["interest_cover"]
    p2 = insight_payload(analyze(qs, cs, Scenario(dso_delta=10)), meta, Scenario(dso_delta=10))
    assert p2["scenario"]["dso_delta"] == 10


def test_analyze_ok():
    r = client.post("/analyze", json={"case": "sample_uk", "scenario": {}, "insights": False})
    assert r.status_code == 200
    assert r.json()["analysis"]["points"]


def test_scenario_moves_breach():
    base = client.post("/analyze", json={"case": "sample_uk", "scenario": {}, "insights": False}).json()
    shocked = client.post("/analyze", json={"case": "sample_uk", "scenario": {"dso_delta": 30},
                                            "insights": False}).json()
    assert base["analysis"]["first_breach"] is None
    assert shocked["analysis"]["first_breach"] is not None


def test_short_history_422():
    q = client.get("/cases/sample_uk").json()["quarters"][:3]
    r = client.post("/analyze", json={"case": "sample_uk", "quarters": q, "scenario": {}, "insights": False})
    assert r.status_code == 422


def test_analyze_nortech_handles_infinite_leverage():
    r = client.post("/analyze", json={"case": "nortech", "scenario": {}, "insights": False})
    assert r.status_code == 200
    vals = [p["value"] for p in r.json()["analysis"]["points"]]
    assert all(isinstance(v, (int, float)) for v in vals)


def test_backtest_flags_q3_2024():
    rows = client.get("/backtest/nortech").json()["rows"]
    row = next(r for r in rows if r["as_of"] == "2024-09-30")
    assert row["predicted_first_breach"]["kind"] == "leverage"
    assert any(r["actual_in_compliance"] is False for r in rows)


def test_ask_endpoint_logs_and_returns_answer(monkeypatch):
    import api.main as m
    monkeypatch.setattr(m, "ask", lambda case, q, cs=None: {"answer": "ok", "tool_calls": [], "unverified_numbers": []})
    r = client.post("/ask", json={"case": "sample_uk", "question": "Can we spend 2m?"})
    assert r.status_code == 200
    assert r.json()["answer"] == "ok"
    assert client.post("/ask", json={"case": "nope", "question": "x"}).status_code == 404


def test_backtest_stops_at_last_bofa_test():
    rows = client.get("/backtest/nortech").json()["rows"]
    assert rows[-1]["as_of"] == "2025-12-31"  # refinanced with a new lender in Mar 2026


def test_backtest_row_explains_suspended_tests():
    rows = client.get("/backtest/nortech").json()["rows"]
    row = next(r for r in rows if r["as_of"] == "2025-09-30")
    assert row["actual_in_compliance"] is True
    assert "suspended" in row["note"]


def test_agreement_rejects_pdf():
    r = client.post("/agreement", files={"file": ("a.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 415
