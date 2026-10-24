from pathlib import Path

from api.extract_financials import read_xlsx_lines

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "sample_uk" / "management_accounts.xlsx"


def test_read_xlsx_lines():
    lines = read_xlsx_lines(SAMPLE)
    assert len(lines) > 10
    assert "Debtors control" in lines
    assert "Account" not in lines  # header row skipped
