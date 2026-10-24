"""Synthetic UK client: Ashby & Rowe Engineering Ltd (fictional), family-owned, HSBC-style RCF + term loan.

Writes data/sample_uk/{quarters.json, covenants.json, agreement.txt, management_accounts.xlsx}.
Numbers are tuned so the base case keeps headroom, but customers paying 10 days later breaches
the leverage covenant when it steps down on 31 March 2027.
"""
import json
import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.engine.forecast import next_quarter_end  # noqa: E402
from api.models import Covenant, CovenantSet, Facility, Quarter, StepDown  # noqa: E402

OUT = ROOT / "data" / "sample_uk"
SEASON = [0.98, 1.00, 0.99, 1.03]  # Q1..Q4 revenue seasonality
BASE_REV = 9.6                      # £m per quarter in year 1
GROWTH = 0.02                       # per year
MARGIN = 0.118                      # EBITDA margin
DEBT0, PRINCIPAL = 16.55, 0.25       # £m term + RCF, quarterly amortisation
RATE = 0.0725 / 4                   # SONIA ~4.25% + 3.00% margin
DSO, DIO, DPO = 58, 62, 45


def build() -> list[Quarter]:
    qs, d, cash, debt = [], date(2023, 12, 31), 1.2, DEBT0
    prev_nwc = None
    for i in range(12):
        season = SEASON[(d.month - 1) // 3]
        rev = BASE_REV * season * (1 + GROWTH) ** (i / 4)
        cogs = rev * 0.68
        ebitda = rev * MARGIN
        da = 0.32
        capex = 0.58
        interest = debt * RATE
        ar, inv, ap = DSO * rev / 91.25, DIO * cogs / 91.25, DPO * cogs / 91.25
        nwc = ar + inv - ap
        if prev_nwc is not None:
            cash += ebitda - interest - capex - (nwc - prev_nwc) - PRINCIPAL
            debt -= PRINCIPAL
        prev_nwc = nwc
        qs.append(Quarter(period_end=d, revenue=round(rev, 3), cogs=round(cogs, 3), ebit=round(ebitda - da, 3),
                          da=da, interest_expense=round(interest, 3), capex=capex, principal_paid=PRINCIPAL,
                          cash=round(cash, 3), debt=round(debt, 3), receivables=round(ar, 3),
                          inventory=round(inv, 3), payables=round(ap, 3)))
        d = next_quarter_end(d)
    return qs


COVENANTS = CovenantSet(
    covenants=[
        Covenant(kind="leverage", comparator="max", threshold=3.25,
                 step_downs=[StepDown(date=date(2025, 3, 31), threshold=3.0),
                             StepDown(date=date(2027, 3, 31), threshold=2.5)],
                 addbacks=["exceptional restructuring costs"], addback_cap_pct=0.10,
                 source_quote="Leverage in respect of any Relevant Period shall not exceed 3.25:1 for each Relevant "
                              "Period ending on or before 31 December 2024, 3.00:1 for each Relevant Period ending "
                              "on or before 31 December 2026 and 2.50:1 thereafter."),
        Covenant(kind="interest_cover", comparator="min", threshold=3.0,
                 source_quote="Interest Cover in respect of any Relevant Period shall not be less than 3.00:1."),
    ],
    facility=Facility(size=18.0, maturity=date(2028, 3, 31), margin_pct=3.0, base_rate_name="SONIA",
                      source_quote="Termination Date means 31 March 2028. Margin means 3.00 per cent. per annum."),
)

AGREEMENT = """FACILITIES AGREEMENT dated 31 March 2023 between ASHBY & ROWE ENGINEERING LIMITED (the "Company") and
NORTHGATE BANK PLC (the "Lender"). £12,000,000 term loan facility and £6,000,000 revolving credit facility.

1. DEFINITIONS
"Consolidated EBITDA" means, in respect of any Relevant Period, the operating profit of the Group before taxation,
before deducting any Finance Costs, before taking into account any Exceptional Items (provided that exceptional
restructuring costs added back shall not exceed 10 per cent. of Consolidated EBITDA in any Relevant Period), and
before deducting any amount attributable to the amortisation of intangible assets or depreciation of tangible assets.
"Interest Cover" means the ratio of Consolidated EBITDA to Finance Charges in respect of any Relevant Period.
"Leverage" means the ratio of Total Net Debt on the last day of a Relevant Period to Consolidated EBITDA in respect
of that Relevant Period.
"Total Net Debt" means the aggregate amount of all obligations of the Group for or in respect of Borrowings, less
cash and cash equivalent investments held by the Group.
"Relevant Period" means each period of twelve months ending on a Quarter Date.
"Termination Date" means 31 March 2028.
"Margin" means 3.00 per cent. per annum over Compounded Reference Rate (SONIA).

21. FINANCIAL COVENANTS
21.1 Financial condition. The Company shall ensure that:
(a) Leverage: Leverage in respect of any Relevant Period shall not exceed 3.25:1 for each Relevant Period ending
on or before 31 December 2024, 3.00:1 for each Relevant Period ending on or before 31 December 2026 and 2.50:1
thereafter.
(b) Interest Cover: Interest Cover in respect of any Relevant Period shall not be less than 3.00:1.
21.2 Financial testing. The financial covenants shall be tested by reference to each of the financial statements
and each Compliance Certificate delivered quarterly.
"""

# messy monthly management-account line names, as a bookkeeper would label them
LINES = [
    ("Sales - UK trade", "revenue", 0.78), ("Sales - export EU", "revenue", 0.22),
    ("Materials & subcon", "cogs", 0.70), ("Direct labour", "cogs", 0.30),
    ("Wages & salaries - admin", "opex", 0.55), ("Rent & rates Unit 4", "opex", 0.20),
    ("Light heat power", "opex", 0.15), ("Motor & travel", "opex", 0.10),
    ("Dep'n plant & machinery", "da", 1.0), ("Bank int pd - HSBC", "interest", 1.0),
    ("Plant additions (capex)", "capex", 1.0),
    ("Debtors control", "receivables", 1.0), ("Stock - raw mat", "inventory", 0.55),
    ("Stock - WIP", "inventory", 0.45), ("Trade creditors", "payables", 1.0),
    ("Cash at bank - current a/c", "cash", 1.0), ("RCF drawn", "debt", 0.35), ("Term loan", "debt", 0.65),
    ("Exceptional - restructuring", "addbacks", 1.0),
]


def write_xlsx(qs: list[Quarter]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Mgmt accounts"
    months = []
    for q in qs[-4:]:
        for k in range(3):
            m = q.period_end.month - 2 + k
            months.append(date(q.period_end.year, m, 1).strftime("%b-%y"))
    ws.append(["Account"] + months)
    for name, cat, share in LINES:
        row = [name]
        for q in qs[-4:]:
            for k in range(3):
                if cat in ("receivables", "inventory", "payables", "cash", "debt"):
                    v = getattr(q, cat) * share  # balances: same at each month end, roughly
                elif cat == "opex":
                    v = (q.revenue - q.cogs - q.ebitda) * share / 3
                elif cat == "interest":
                    v = q.interest_expense / 3
                elif cat == "addbacks":
                    v = 0.0
                else:
                    v = getattr(q, cat) * share / 3
                row.append(round(v * 1000, 1))  # £k
        ws.append(row)
    wb.save(OUT / "management_accounts.xlsx")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    qs = build()
    (OUT / "quarters.json").write_text(json.dumps([q.model_dump(mode="json") for q in qs], indent=1), encoding="utf-8")
    (OUT / "covenants.json").write_text(COVENANTS.model_dump_json(indent=1), encoding="utf-8")
    (OUT / "agreement.txt").write_text(AGREEMENT, encoding="utf-8")
    write_xlsx(qs)


if __name__ == "__main__":
    main()
