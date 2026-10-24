from pathlib import Path

import pytest

from api.edgar import CACHE, deaccumulate, to_quarters


def test_deaccumulate():
    assert deaccumulate([1, 3, 6, 10]) == [1, 2, 3, 4]


@pytest.mark.skipif(not Path(CACHE).exists(), reason="companyfacts not cached")
def test_to_quarters_shape():
    import json
    qs = to_quarters(json.loads(Path(CACHE).read_text(encoding="utf-8")))
    assert len(qs) >= 8
    assert all(a.period_end < b.period_end for a, b in zip(qs, qs[1:]))
    assert all(q.revenue > 0 for q in qs)
