"""PDF uploads: agreement text and accounts tables read deterministically (never by the model).

Fixtures in tests/fixtures are the Ashby & Rowe demo files printed to PDF by Chromium; the accounts
PDF splits its 36 months across two pages, each repeating the account names, as print-outs do.
"""
from pathlib import Path

import pytest

from api.pdf import parse_number, pdf_text
from api.upload import read_sheet, read_table

FIX = Path(__file__).parent / "fixtures"
DEMO = Path(__file__).parents[1] / "demo_files" / "ashby_rowe"


def _same(pdf_name: str, xlsx_name: str):
    pcols, plines = read_table((FIX / pdf_name).read_bytes(), pdf_name)
    xcols, xlines = read_sheet((DEMO / xlsx_name).read_bytes())
    assert pcols == xcols
    assert [n for n, _ in plines] == [n for n, _ in xlines]
    for (n, pv), (_, xv) in zip(plines, xlines):
        assert pv == pytest.approx(xv), n


def test_accounts_pdf_split_across_pages_matches_the_spreadsheet():
    _same("ashby_rowe_accounts.pdf", "ashby_rowe_management_accounts.xlsx")


def test_budget_pdf_matches_the_spreadsheet():
    _same("ashby_rowe_budget.pdf", "ashby_rowe_budget_fy27.xlsx")


def test_agreement_pdf_text_keeps_the_covenant_wording():
    text = pdf_text((FIX / "ashby_rowe_agreement.pdf").read_bytes())
    original = (DEMO / "facility_agreement.txt").read_text(encoding="utf-8")
    assert " ".join(text.split()) == " ".join(original.split())


def test_scanned_pdf_is_a_clear_error():
    with pytest.raises(ValueError, match="looks scanned"):
        pdf_text((FIX / "scanned_agreement.pdf").read_bytes())
    with pytest.raises(ValueError, match="looks scanned"):
        read_table((FIX / "scanned_agreement.pdf").read_bytes(), "accounts.pdf")


def test_text_pdf_without_a_table_is_a_clear_error():
    with pytest.raises(ValueError, match="no table"):
        read_table((FIX / "ashby_rowe_agreement.pdf").read_bytes(), "accounts.pdf")


@pytest.mark.parametrize("raw, value", [
    ("1,234.5", 1234.5), ("(56.2)", -56.2), ("-56.2", -56.2), ("-", 0.0), ("", 0.0), (None, 0.0),
    ("£1,234", 1234.0), ("$ 12", 12.0), ("€3.5", 3.5), ("–", 0.0),
])
def test_parse_number_reads_accounting_formats(raw, value):
    assert parse_number(raw) == pytest.approx(value)


@pytest.mark.parametrize("raw", ["n/a", "12 34", "1.2.3", "TBC"])
def test_parse_number_refuses_anything_it_cannot_read_exactly(raw):
    with pytest.raises(ValueError, match="not a number"):
        parse_number(raw)


def test_company_upload_accepts_pdfs_and_sends_pdf_text_to_the_model(monkeypatch):
    from fastapi.testclient import TestClient

    import api.main as main

    seen = {}

    def capture(text, *_a, **_k):
        seen["text"] = text
        raise ValueError("stop after extraction input")

    monkeypatch.setattr(main, "extract_covenants", capture)
    monkeypatch.setattr(main, "log_outbound", lambda *a: None)
    files = {"agreement": ("agreement.pdf", (FIX / "ashby_rowe_agreement.pdf").read_bytes(), "application/pdf"),
             "financials": ("accounts.pdf", (FIX / "ashby_rowe_accounts.pdf").read_bytes(), "application/pdf"),
             "budget": ("budget.pdf", (FIX / "ashby_rowe_budget.pdf").read_bytes(), "application/pdf")}
    r = TestClient(main.app).post("/company", data={"name": "Test Co"}, files=files)
    assert r.status_code == 422 and "stop after extraction input" in r.json()["detail"]
    assert "3.25" in seen["text"] or "Leverage" in seen["text"]


def test_company_upload_rejects_a_scanned_agreement(monkeypatch):
    from fastapi.testclient import TestClient

    import api.main as main

    monkeypatch.setattr(main, "log_outbound", lambda *a: None)
    files = {"agreement": ("scan.pdf", (FIX / "scanned_agreement.pdf").read_bytes(), "application/pdf"),
             "financials": ("accounts.pdf", (FIX / "ashby_rowe_accounts.pdf").read_bytes(), "application/pdf")}
    r = TestClient(main.app).post("/company", data={"name": "Test Co"}, files=files)
    assert r.status_code == 422
    assert "looks scanned" in r.json()["detail"]
