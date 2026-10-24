import math
from datetime import date

from api.models import Covenant, Quarter


def threshold_at(cov: Covenant, d: date) -> float | None:
    """Latest step-down on or before d, else the base threshold. None before the covenant applies."""
    if cov.effective_from and d < cov.effective_from:
        return None
    t = cov.threshold
    for s in sorted(cov.step_downs, key=lambda s: s.date):
        if s.date <= d:
            t = s.threshold
    return t


def _ratio(num: float, den: float) -> float:
    if den <= 0:
        return math.inf
    return num / den


def metric_value(cov: Covenant, quarters: list[Quarter], i: int) -> float:
    window = quarters[max(0, i - cov.measurement_quarters + 1): i + 1]
    ebitda = sum(q.ebitda for q in window)
    interest = sum(q.interest_expense for q in window)
    last = quarters[i]
    if cov.kind == "leverage":
        debt = last.debt - last.cash if cov.nets_cash else last.debt
        return _ratio(debt, ebitda)
    if cov.kind == "interest_cover":
        return _ratio(ebitda, interest)
    if cov.kind == "fixed_charge_cover":
        capex = sum(q.capex for q in window)
        principal = sum(q.principal_paid for q in window)
        return _ratio(ebitda - capex, interest + principal)
    return ebitda  # min_ebitda


def headroom_pct(cov: Covenant, value: float, threshold: float) -> float:
    """Fraction of the threshold left before breach. Negative means breached."""
    if math.isinf(value):
        return -1.0 if cov.comparator == "max" else 1.0
    if cov.comparator == "max":
        return (threshold - value) / threshold
    return (value - threshold) / threshold
