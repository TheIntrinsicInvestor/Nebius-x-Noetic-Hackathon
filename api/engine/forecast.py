import calendar
from datetime import date

from api.models import BudgetQuarter, Quarter, Scenario

DAYS = 91.25  # days per quarter for receivable/inventory/supplier days


def next_quarter_end(d: date) -> date:
    m = d.month + 3
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    return date(y, m, calendar.monthrange(y, m)[1])


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


def _days(num: float, den: float) -> float:
    return num / den * DAYS if den else 0.0


def project(history: list[Quarter], n: int = 6, sc: Scenario = Scenario(),
            budget: list[BudgetQuarter] | None = None) -> list[Quarter]:
    """Driver-based quarterly projection from the company's own trailing history. Quarters covered by the
    finance team's budget take its P&L and capex; working capital, cash and debt are derived the same way."""
    if len(history) < 4:
        raise ValueError("need >= 4 quarters")
    last4 = history[-4:]

    growths = [history[i].revenue / history[i - 4].revenue - 1
               for i in range(len(history) - 4, len(history))
               if i >= 4 and history[i - 4].revenue]
    g = max(-0.3, min(0.3, _mean(growths))) if growths else 0.0

    rev4 = sum(q.revenue for q in last4)
    margin = sum(q.ebitda for q in last4) / rev4 * (1 + sc.ebitda_pct)
    cogs_ratio = sum(q.cogs for q in last4) / rev4
    da = _mean([q.da for q in last4])
    capex = _mean([q.capex for q in last4])
    principal = _mean([q.principal_paid for q in last4])
    # negative levers model improvements; floor at zero so a big cut cannot go below nothing
    dso = max(0.0, _mean([_days(q.receivables, q.revenue) for q in last4]) + sc.dso_delta)
    dio = max(0.0, _mean([_days(q.inventory, q.cogs) for q in last4]) + sc.dio_delta)
    dpo = _mean([_days(q.payables, q.cogs) for q in last4])
    debt4 = sum(q.debt for q in last4)
    rate = max(0.0, (sum(q.interest_expense for q in last4) / debt4 if debt4 else 0.0) + sc.rate_bp / 1e4 / 4)

    plan = {b.period_end: b for b in budget or []}
    base_rev = [q.revenue for q in history]  # revenue path before the scenario shock
    prev = history[-1]
    out: list[Quarter] = []
    for k in range(n):
        end = next_quarter_end(prev.period_end)
        b = plan.get(end)
        base_rev.append(b.revenue if b else base_rev[-4] * (1 + g))
        revenue = base_rev[-1] * (1 + sc.revenue_pct)
        if b:
            ebitda = b.ebitda * (1 + sc.revenue_pct) * (1 + sc.ebitda_pct)
            cogs = b.cogs * (1 + sc.revenue_pct)
            q_da, q_principal, q_capex = b.da, b.principal_paid, b.capex
        else:
            ebitda = margin * revenue
            cogs = cogs_ratio * revenue
            q_da, q_principal, q_capex = da, principal, capex
        q_capex = max(0.0, q_capex + (sc.capex_extra / 4 if k < 4 else 0.0))
        receivables = dso * revenue / DAYS
        inventory = dio * cogs / DAYS
        payables = dpo * cogs / DAYS
        interest = rate * prev.debt
        d_nwc = (receivables + inventory - payables) - (prev.receivables + prev.inventory - prev.payables)
        debt = prev.debt - q_principal
        cash = prev.cash + ebitda - interest - q_capex - d_nwc - q_principal
        if cash < 0:  # draw on the revolver
            debt += -cash
            cash = 0.0
        q = Quarter(period_end=end, revenue=revenue, cogs=cogs,
                    ebit=ebitda - q_da, da=q_da, interest_expense=interest, capex=q_capex,
                    principal_paid=q_principal, addbacks=0, cash=cash, debt=debt,
                    receivables=receivables, inventory=inventory, payables=payables)
        out.append(q)
        prev = q
    return out
