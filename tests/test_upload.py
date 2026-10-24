import io
from datetime import date

import pytest
from openpyxl import Workbook

from api.extract_financials import MappedLine
from api.upload import build_quarters, read_sheet, slug


def _xlsx(header, rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _m(name, cat):
    return MappedLine(name=name, category=cat, confidence=1.0)


def test_monthly_flows_sum_and_balances_take_quarter_end():
    months = ["Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26",
              "Oct-26", "Nov-26", "Dec-26"]
    data = _xlsx(["Account"] + months, [["Sales", *[100] * 12], ["Debtors control", *range(1, 13)]])
    cols, lines = read_sheet(data)
    qs = build_quarters(cols, lines, [_m("Sales", "revenue"), _m("Debtors control", "receivables")], "thousands")
    assert [q.period_end for q in qs] == [date(2026, 3, 31), date(2026, 6, 30), date(2026, 9, 30), date(2026, 12, 31)]
    assert qs[0].revenue == pytest.approx(0.3)  # 3 x 100k = 0.3m
    assert qs[0].receivables == pytest.approx(0.003)  # March balance, 3k
    assert qs[-1].receivables == pytest.approx(0.012)


def test_quarterly_columns_and_ebit_from_categories():
    data = _xlsx(["Account", "Mar-24", "Jun-24", "Sep-24", "Dec-24"],
                 [["Net sales", 1000, 1000, 1000, 1000], ["COGS", 600, 600, 600, 600],
                  ["SG&A", 200, 200, 200, 200], ["Depreciation", 50, 50, 50, 50]])
    cols, lines = read_sheet(data)
    m = [_m("Net sales", "revenue"), _m("COGS", "cogs"), _m("SG&A", "opex"), _m("Depreciation", "da")]
    qs = build_quarters(cols, lines, m)
    assert len(qs) == 4
    assert qs[0].revenue == pytest.approx(1.0)
    assert qs[0].ebit == pytest.approx(0.15)
    assert qs[0].ebitda == pytest.approx(0.2)


def test_too_few_quarters_is_a_clear_error():
    data = _xlsx(["Account", "Jan-26", "Feb-26", "Mar-26", "Apr-26"], [["Sales", 1, 1, 1, 1]])
    cols, lines = read_sheet(data)
    with pytest.raises(ValueError, match="at least 4 complete quarters"):
        build_quarters(cols, lines, [_m("Sales", "revenue")])


def test_bad_header_is_a_clear_error():
    with pytest.raises(ValueError, match="not a month"):
        read_sheet(_xlsx(["Account", "FY total"], [["Sales", 1]]))


def test_slug_is_prefixed_and_safe():
    assert slug("Nortech Systems, Inc.") == "u-nortech-systems-inc"
    assert slug("!!!") == "u-company"


def test_model_outage_returns_readable_502_with_cors(monkeypatch):
    import httpx
    import openai
    from fastapi.testclient import TestClient

    import api.main as main

    def boom(*_a, **_k):  # both models down
        raise openai.APIConnectionError(request=httpx.Request("POST", "https://example.test"))

    monkeypatch.setattr(main, "extract_covenants", boom)
    monkeypatch.setattr(main, "log_outbound", lambda *a: None)
    monkeypatch.setattr(main, "RETRY_PAUSE_S", 0)
    client = TestClient(main.app)
    files = {"agreement": ("a.txt", b"Leverage shall not exceed 3.00:1", "text/plain"),
             "financials": ("f.xlsx", _xlsx(["Account", "Mar-24"], [["Sales", 1]]), "application/octet-stream")}
    r = client.post("/company", data={"name": "Test Co"}, files=files, headers={"Origin": "http://localhost:3000"})
    assert r.status_code == 502
    assert "temporarily unavailable" in r.json()["detail"]
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_primary_model_error_falls_back_to_second_model(monkeypatch):
    import httpx
    import openai

    from api.llm import SECOND_MODEL
    import api.main as main
    from api.main import with_fallback

    monkeypatch.setattr(main, "RETRY_PAUSE_S", 0)

    def flaky(x, model="primary"):
        if model != SECOND_MODEL:
            raise openai.APIConnectionError(request=httpx.Request("POST", "https://example.test"))
        return x, model

    assert with_fallback(flaky, 1) == (1, SECOND_MODEL)


def test_budget_keeps_only_quarters_after_actuals():
    from api.upload import build_budget

    data = _xlsx(["Account", "Sep-26", "Dec-26", "Mar-27"],
                 [["Sales", 1000, 1100, 1200], ["COGS", 600, 600, 600], ["Overheads", 100, 100, 100],
                  ["New press line", 0, 0, 2000]])
    cols, lines = read_sheet(data)
    m = [_m("Sales", "revenue"), _m("COGS", "cogs"), _m("Overheads", "opex"), _m("New press line", "capex")]
    b = build_budget(cols, lines, m, "thousands", after=date(2026, 9, 30))
    assert [q.period_end for q in b] == [date(2026, 12, 31), date(2027, 3, 31)]
    assert b[0].ebitda == pytest.approx(0.4)
    assert b[1].capex == pytest.approx(2.0)
    with pytest.raises(ValueError, match="no complete quarter after"):
        build_budget(cols, lines, m, "thousands", after=date(2027, 3, 31))


def test_forecast_uses_budget_then_trend():
    from api.cases import load_case
    from api.engine.forecast import project
    from api.models import BudgetQuarter

    qs, _, _ = load_case("sample_uk")
    trend = project(qs, 6)
    plan = [BudgetQuarter(period_end=trend[0].period_end, revenue=20.0, cogs=12.0, ebitda=3.0, da=0.5, capex=4.0)]
    fc = project(qs, 6, budget=plan)
    assert fc[0].revenue == pytest.approx(20.0)
    assert fc[0].ebitda == pytest.approx(3.0)
    assert fc[0].capex == pytest.approx(4.0)
    assert fc[1].revenue == pytest.approx(trend[1].revenue)  # after the budget: trend again
