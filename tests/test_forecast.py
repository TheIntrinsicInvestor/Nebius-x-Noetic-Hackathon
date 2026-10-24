from datetime import date

import pytest

from api.engine.forecast import project
from api.models import Scenario
from tests.test_models import make_quarter

DATES = [date(2024, 3, 31), date(2024, 6, 30), date(2024, 9, 30), date(2024, 12, 31),
         date(2025, 3, 31), date(2025, 6, 30), date(2025, 9, 30), date(2025, 12, 31)]


def flat_history(**kw):
    # revenue 25, EBITDA 2.5, interest 1.0 + capex 1.5 = EBITDA, so free cash flow is zero
    base = dict(revenue=25, cogs=18, ebit=1.5, da=1, interest_expense=1.0, capex=1.5,
                cash=5, debt=30, receivables=7, inventory=5, payables=4)
    base.update(kw)
    return [make_quarter(period_end=d, **base) for d in DATES]


def test_project_requires_4_quarters():
    with pytest.raises(ValueError, match="need >= 4 quarters"):
        project(flat_history()[:3])


def test_project_flat_history_is_flat():
    f = project(flat_history(), n=6)
    assert len(f) == 6
    assert f[0].period_end == date(2026, 3, 31)
    assert f[-1].period_end == date(2027, 6, 30)
    for q in f:
        assert q.revenue == pytest.approx(25, abs=1e-6)
        assert q.ebitda == pytest.approx(2.5, abs=1e-6)
        assert q.cash == pytest.approx(5, abs=1e-6)


def test_dso_delta_consumes_cash():
    base = project(flat_history(), n=2)
    shocked = project(flat_history(), n=2, sc=Scenario(dso_delta=10))
    assert base[0].cash - shocked[0].cash == pytest.approx(25 / 91.25 * 10, abs=0.01)


def test_improvement_levers_release_cash():
    base = project(flat_history(), n=2)
    better = project(flat_history(), n=2, sc=Scenario(dso_delta=-10))
    assert better[0].cash - base[0].cash == pytest.approx(25 / 91.25 * 10, abs=0.01)


def test_improvement_levers_floor_at_zero():
    # cuts larger than the business can deliver stop at zero days, zero capex, zero rate
    f = project(flat_history(), n=4, sc=Scenario(dso_delta=-1000, capex_extra=-100, rate_bp=-10000))
    for q in f:
        assert q.receivables == 0
        assert q.capex == 0
        assert q.interest_expense == 0


def test_revolver_draw():
    f = project(flat_history(capex=6), n=4)
    assert min(q.cash for q in f) >= 0
    assert f[-1].cash == 0
    assert f[-1].debt > 30
