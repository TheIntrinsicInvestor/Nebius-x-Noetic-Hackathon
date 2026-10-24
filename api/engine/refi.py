from datetime import date

from api.models import Facility

WAIVER_FEE = 0.0025   # Nortech's Q4 2025 waiver fee, as a share of debt
MARGIN_STEP = 0.01    # assumed one-year margin step-up after a breach


def _minus_months(d: date, months: int) -> date:
    m = d.month - months
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    try:
        return d.replace(year=y, month=m)
    except ValueError:  # e.g. 31st in a 30-day month
        return d.replace(year=y, month=m, day=28)


def refi_summary(fac: Facility, as_of: date, debt: float) -> dict:
    out: dict = {"est_breach_cost": WAIVER_FEE * debt + MARGIN_STEP * debt,
                 "breach_cost_assumption": "0.25% waiver fee (as paid in real bank waivers) + 1% margin step for a year"}
    if fac.maturity:
        m = fac.maturity
        months = (m.year - as_of.year) * 12 + m.month - as_of.month - (1 if m.day < as_of.day else 0)
        out["months_to_maturity"] = months
        out["start_talks_by"] = _minus_months(m, 12)
        out["talks_overdue"] = out["start_talks_by"] < as_of
        out["maturity"] = m
    return out
