import json
from datetime import date

from api.models import CovenantSet, Quarter


def make_quarter(**kw):
    base = dict(period_end=date(2025, 3, 31), revenue=25, cogs=18, ebit=10, da=3,
                interest_expense=0.5, capex=1, cash=5, debt=30, receivables=7,
                inventory=5, payables=4)
    base.update(kw)
    return Quarter(**base)


def test_quarter_ebitda():
    assert make_quarter(ebit=10, da=3, addbacks=2).ebitda == 15


def test_covenantset_schema_has_source_quote():
    assert "source_quote" in json.dumps(CovenantSet.model_json_schema())
