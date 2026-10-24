from datetime import date

from api.explain import allowed_numbers, validate_numbers


def test_validate_flags_invented_number():
    a = allowed_numbers({"headroom_pct": 0.142})
    assert validate_numbers("Headroom is 14.2%", a) == []
    assert validate_numbers("Headroom is 19%", a) == ["19"]


def test_allowed_includes_quarter_label():
    a = allowed_numbers({"first_breach": {"period_end": date(2027, 9, 30)}})
    assert validate_numbers("Breach projected in Q3 2027", a) == []


def test_allowed_handles_lists_and_rounding():
    a = allowed_numbers({"points": [{"value": 2.4873}], "dso": 18.0})
    assert validate_numbers("Leverage reaches 2.49x, or 2.5x, after 18 days", a) == []


def test_commas_stripped():
    a = allowed_numbers({"cost": 1250000})
    assert validate_numbers("costs 1,250,000", a) == []
