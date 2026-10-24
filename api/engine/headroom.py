import math
from datetime import date

from pydantic import BaseModel

from api.engine.covenants import headroom_pct, metric_value, threshold_at
from api.engine.forecast import project
from api.engine.refi import refi_summary
from api.models import CovenantSet, Quarter, Scenario


OFF_CHART = 999.0  # shown value when a ratio is undefined (zero or negative EBITDA)


class CovenantPoint(BaseModel):
    period_end: date
    kind: str
    value: float
    threshold: float
    headroom_pct: float
    is_forecast: bool
    breached: bool


class Analysis(BaseModel):
    points: list[CovenantPoint]
    first_breach: CovenantPoint | None
    binding_kind: str | None
    needs_input: list[str]
    reverse_stress: dict[str, float]
    refi: dict
    forecast: list[Quarter]


def _needs_input(cov) -> bool:
    """A missing or non-positive limit can't be tested (and would divide by zero)."""
    return cov.threshold is None or cov.threshold <= 0


def _points(history: list[Quarter], cs: CovenantSet, sc: Scenario, n: int):
    forecast = project(history, n, sc)
    series = history + forecast
    points: list[CovenantPoint] = []
    for cov in cs.covenants:
        if _needs_input(cov):
            continue
        for i in range(cov.measurement_quarters - 1, len(series)):
            d = series[i].period_end
            thr = threshold_at(cov, d)
            if thr is None or thr <= 0:
                continue
            v = metric_value(cov, series, i)
            h = headroom_pct(cov, v, thr)
            shown = v if math.isfinite(v) else OFF_CHART  # JSON has no infinity
            points.append(CovenantPoint(period_end=d, kind=cov.kind, value=shown, threshold=thr,
                                        headroom_pct=h, is_forecast=i >= len(history),
                                        breached=h < 0))
    return points, forecast


def _breaches(history, cs, sc, n) -> bool:
    points, _ = _points(history, cs, sc, n)
    return any(p.breached and p.is_forecast for p in points)


def _reverse_stress(history, cs, sc, n) -> dict[str, float]:
    if _breaches(history, cs, sc, n):
        return {"ebitda_fall_pct": 0, "dso_days": 0}

    def with_(**kw):
        return sc.model_copy(update=kw)

    # largest EBITDA fall with no forecast breach
    lo, hi = -0.9, sc.ebitda_pct
    if not _breaches(history, cs, with_(ebitda_pct=lo), n):
        fall = lo
    else:
        while hi - lo > 0.005:
            mid = (lo + hi) / 2
            if _breaches(history, cs, with_(ebitda_pct=mid), n):
                lo = mid
            else:
                hi = mid
        fall = hi
    # largest receivable-days rise with no forecast breach
    lo, hi = sc.dso_delta, 180.0
    if not _breaches(history, cs, with_(dso_delta=hi), n):
        days = hi
    else:
        while hi - lo > 0.5:
            mid = (lo + hi) / 2
            if _breaches(history, cs, with_(dso_delta=mid), n):
                hi = mid
            else:
                lo = mid
        days = lo
    # room left from where the scenario already is, not from the base case
    return {"ebitda_fall_pct": round(fall - sc.ebitda_pct, 4), "dso_days": round(days - sc.dso_delta, 1)}


def analyze(history: list[Quarter], cs: CovenantSet, sc: Scenario = Scenario(), n: int = 6,
            as_of: date | None = None) -> Analysis:
    points, forecast = _points(history, cs, sc, n)
    fc = [p for p in points if p.is_forecast]
    breached = sorted((p for p in fc if p.breached), key=lambda p: p.period_end)
    binding = min(fc, key=lambda p: p.headroom_pct).kind if fc else None
    return Analysis(
        points=points,
        first_breach=breached[0] if breached else None,
        binding_kind=binding,
        needs_input=[c.kind for c in cs.covenants if _needs_input(c)],
        reverse_stress=_reverse_stress(history, cs, sc, n),
        refi=refi_summary(cs.facility, as_of or history[-1].period_end, history[-1].debt),
        forecast=forecast,
    )
