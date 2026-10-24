from api.copilot import run_scenario_tool


def test_run_scenario_tool_reports_breach_and_headroom():
    base = run_scenario_tool("sample_uk", {})
    assert base["first_breach"] is None
    assert base["lowest_headroom"]["leverage"]["headroom_pct"] > 0
    shocked = run_scenario_tool("sample_uk", {"dso_delta": 10})
    assert shocked["first_breach"]["kind"] == "leverage"
    assert shocked["first_breach"]["quarter"] == "Q1 2027"


def test_run_scenario_tool_ignores_unknown_args():
    r = run_scenario_tool("sample_uk", {"capex_extra": 2.0, "bogus": 5})
    assert r["scenario"]["capex_extra"] == 2.0
    assert "bogus" not in r["scenario"]
