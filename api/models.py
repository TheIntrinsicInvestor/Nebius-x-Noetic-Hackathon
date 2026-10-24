from datetime import date
from typing import Literal

from pydantic import BaseModel

CovenantKind = Literal["leverage", "interest_cover", "fixed_charge_cover", "min_ebitda"]


class StepDown(BaseModel):
    date: date
    threshold: float


class Covenant(BaseModel):
    kind: CovenantKind
    comparator: Literal["max", "min"]
    threshold: float | None
    step_downs: list[StepDown] = []
    test_frequency: Literal["quarterly", "monthly", "annual"] = "quarterly"
    measurement_quarters: int = 4
    nets_cash: bool = True
    addbacks: list[str] = []
    addback_cap_pct: float | None = None
    source_quote: str = ""


class Facility(BaseModel):
    size: float | None = None
    maturity: date | None = None
    margin_pct: float | None = None
    base_rate_name: str | None = None
    source_quote: str = ""


class CovenantSet(BaseModel):
    covenants: list[Covenant]
    facility: Facility


class Quarter(BaseModel):
    period_end: date
    revenue: float
    cogs: float
    ebit: float
    da: float
    interest_expense: float
    capex: float
    principal_paid: float = 0
    addbacks: float = 0
    cash: float
    debt: float
    receivables: float
    inventory: float
    payables: float

    @property
    def ebitda(self) -> float:
        return self.ebit + self.da + self.addbacks


class Scenario(BaseModel):
    revenue_pct: float = 0
    ebitda_pct: float = 0
    dso_delta: float = 0
    dio_delta: float = 0
    capex_extra: float = 0
    rate_bp: float = 0
