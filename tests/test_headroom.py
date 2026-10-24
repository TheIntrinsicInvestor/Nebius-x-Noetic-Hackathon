from datetime import date

import pytest

from api.engine.headroom import analyze
from api.engine.refi import refi_summary
from api.models import Covenant, CovenantSet, Facility, Scenario, StepDown
from tests.test_forecast import flat_history

FAC = Facility(size=30, maturity=date(2027, 10, 24), margin_pct=3.0, base_rate_name="SONIA")


def cs(*covs):
    return CovenantSet(covenants=list(covs), facility=FAC)


def test_first_breach_detected():
    # flat leverage = (30 - 5) / 10 = 2.5; limit steps to 2.0 at the 3rd forecast quarter
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0,
                   step_downs=[StepDown(date=date(2026, 9, 30), threshold=2.0)])
    a = analyze(flat_history(), cs(lev), n=6)
    assert a.first_breach is not None
    assert a.first_breach.period_end == date(2026, 9, 30)
    assert a.binding_kind == "leverage"


def test_no_breach_when_headroom():
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0)
    a = analyze(flat_history(), cs(lev), n=6)
    assert a.first_breach is None
    hist_points = [p for p in a.points if not p.is_forecast]
    assert hist_points[-1].value == pytest.approx(2.5)
    assert hist_points[-1].headroom_pct == pytest.approx(1 / 6)


def test_missing_threshold_goes_to_needs_input():
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0)
    fccr = Covenant(kind="fixed_charge_cover", comparator="min", threshold=None)
    a = analyze(flat_history(), cs(lev, fccr), n=4)
    assert a.needs_input == ["fixed_charge_cover"]
    assert all(p.kind != "fixed_charge_cover" for p in a.points)


def test_no_points_before_effective_from():
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0, effective_from=date(2026, 6, 30))
    a = analyze(flat_history(), cs(lev), n=4)
    assert min(p.period_end for p in a.points) == date(2026, 6, 30)


def test_reverse_stress_is_the_breach_boundary():
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0)
    a = analyze(flat_history(), cs(lev), n=6)
    x = a.reverse_stress["ebitda_fall_pct"]
    assert -0.9 < x < 0
    covs = cs(lev)
    assert analyze(flat_history(), covs, Scenario(ebitda_pct=x + 0.002), n=6).first_breach is None
    assert analyze(flat_history(), covs, Scenario(ebitda_pct=x - 0.02), n=6).first_breach is not None
    d = a.reverse_stress["dso_days"]
    assert 0 < d < 180
    assert analyze(flat_history(), covs, Scenario(dso_delta=d + 2), n=6).first_breach is not None


def test_reverse_stress_zero_when_base_breaches():
    lev = Covenant(kind="leverage", comparator="max", threshold=2.0)
    a = analyze(flat_history(), cs(lev), n=4)
    assert a.reverse_stress["ebitda_fall_pct"] == 0
    assert a.reverse_stress["dso_days"] == 0


def test_short_history_raises():
    lev = Covenant(kind="leverage", comparator="max", threshold=3.0)
    with pytest.raises(ValueError, match="need >= 4 quarters"):
        analyze(flat_history()[:3], cs(lev))


def test_refi_talks_overdue():
    r = refi_summary(FAC, date(2027, 1, 31), debt=30)
    assert r["talks_overdue"] is True
    assert refi_summary(FAC, date(2026, 1, 31), debt=30)["talks_overdue"] is False


def test_refi_summary():
    r = refi_summary(FAC, date(2026, 10, 24), debt=30)
    assert r["months_to_maturity"] == 12
    assert r["start_talks_by"] == date(2026, 10, 24)
    assert r["est_breach_cost"] == pytest.approx(0.0025 * 30 + 0.01 * 30)
