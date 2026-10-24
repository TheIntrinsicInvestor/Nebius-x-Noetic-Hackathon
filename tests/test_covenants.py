import math
from datetime import date

import pytest

from api.engine.covenants import headroom_pct, metric_value, threshold_at
from api.models import Covenant, StepDown
from tests.test_models import make_quarter

QDATES = [date(2025, 3, 31), date(2025, 6, 30), date(2025, 9, 30), date(2025, 12, 31)]


def quarters(ebitda=2.5, debt=30, cash=5, capex=0.5, interest=0.5, principal=0.0):
    # ebit + da = ebitda
    return [make_quarter(period_end=d, ebit=ebitda - 1, da=1, debt=debt, cash=cash,
                         capex=capex, interest_expense=interest, principal_paid=principal)
            for d in QDATES]


def test_threshold_step_down():
    cov = Covenant(kind="leverage", comparator="max", threshold=4.25,
                   step_downs=[StepDown(date=date(2026, 6, 30), threshold=4.0),
                               StepDown(date=date(2027, 6, 30), threshold=3.75)])
    assert threshold_at(cov, date(2026, 3, 31)) == 4.25
    assert threshold_at(cov, date(2026, 9, 30)) == 4.0
    assert threshold_at(cov, date(2027, 6, 30)) == 3.75


def test_threshold_none_before_effective_from():
    cov = Covenant(kind="min_ebitda", comparator="min", threshold=1.0, effective_from=date(2025, 6, 30))
    assert threshold_at(cov, date(2025, 3, 31)) is None
    assert threshold_at(cov, date(2025, 6, 30)) == 1.0


def test_leverage():
    q = quarters()
    cov = Covenant(kind="leverage", comparator="max", threshold=3.0)
    assert metric_value(cov, q, 3) == pytest.approx(2.5)
    cov_gross = Covenant(kind="leverage", comparator="max", threshold=3.0, nets_cash=False)
    assert metric_value(cov_gross, q, 3) == pytest.approx(3.0)


def test_zero_ebitda_leverage_inf_and_breach():
    q = quarters(ebitda=0)
    cov = Covenant(kind="leverage", comparator="max", threshold=3.0)
    assert metric_value(cov, q, 3) == math.inf
    assert headroom_pct(cov, math.inf, 3.0) == -1.0


def test_zero_interest_cover_inf_passes():
    q = quarters(interest=0)
    cov = Covenant(kind="interest_cover", comparator="min", threshold=3.0)
    assert metric_value(cov, q, 3) == math.inf
    assert headroom_pct(cov, math.inf, 3.0) == 1.0


def test_fccr():
    q = quarters(ebitda=2.5, capex=0.5, interest=0.5, principal=0.5)
    cov = Covenant(kind="fixed_charge_cover", comparator="min", threshold=1.25)
    assert metric_value(cov, q, 3) == pytest.approx(2.0)


def test_min_ebitda_two_quarter_window():
    q = quarters()
    q[2] = make_quarter(period_end=QDATES[2], ebit=-0.3, da=1)
    q[3] = make_quarter(period_end=QDATES[3], ebit=-0.1, da=1)
    cov = Covenant(kind="min_ebitda", comparator="min", threshold=1.6, measurement_quarters=2)
    v = metric_value(cov, q, 3)
    assert v == pytest.approx(1.6)
    assert headroom_pct(cov, v, 1.6) == pytest.approx(0.0)
