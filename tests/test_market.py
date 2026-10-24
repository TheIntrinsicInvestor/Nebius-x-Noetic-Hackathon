import re

from api.cases import META, load_case
from api.market import market_queries


def test_queries_use_only_public_metadata():
    qs, cs, meta = load_case("sample_uk")
    queries = market_queries(meta)
    assert 2 <= len(queries) <= 3
    numbers = {f"{q.revenue:.1f}" for q in qs} | {f"{q.debt:.1f}" for q in qs} | {str(c.threshold) for c in cs.covenants}
    for q in queries:
        assert not any(n in q for n in numbers)
        assert not re.search(r"\d+\.\d", q)  # no decimals at all: years only
    assert any(meta["base_rate"] in q for q in queries)


def test_every_case_has_market_metadata():
    for m in META.values():
        assert {"sector", "country", "lender", "base_rate"} <= m.keys()
