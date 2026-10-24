from api.locate import html_to_text, locate_sections

TEXT = """
ARTICLE I DEFINITIONS
"Consolidated EBITDA" means, for any Measurement Period, Consolidated Net Income plus interest,
taxes, depreciation and amortization, plus non-cash charges.
"Consolidated Leverage Ratio" means the ratio of Consolidated Funded Indebtedness to Consolidated EBITDA.
"Lien" means any mortgage or pledge.
ARTICLE VII NEGATIVE COVENANTS
Section 7.11 Financial Covenants. (a) Consolidated Leverage Ratio. Permit the Consolidated Leverage
Ratio as of the end of any fiscal quarter to be greater than 3.00 to 1.00.
"""


def test_locates_covenant_section():
    chunks = locate_sections(TEXT)
    assert chunks[0].title == "covenants"
    assert "greater than 3.00 to 1.00" in chunks[0].text


def test_locates_definition_until_next():
    chunks = {c.title: c.text for c in locate_sections(TEXT)}
    ebitda = chunks["Consolidated EBITDA"]
    assert "non-cash charges" in ebitda
    assert "Funded Indebtedness" not in ebitda
    assert "Consolidated Leverage Ratio" in chunks


def test_prose_fallback_finds_ratio_sentence():
    text = ("Item 1.01. On June 25 the Company amended its credit agreement. " * 3 +
            "The amendment provides that the total leverage ratio may not exceed 4.25 to 1.0 for the quarter.")
    chunks = locate_sections(text)
    assert chunks[0].title == "covenants"
    assert "4.25 to 1.0" in chunks[0].text


def test_no_match_returns_empty():
    assert locate_sections("A lease agreement about a warehouse.") == []


def test_html_to_text():
    assert html_to_text("<p>Section&nbsp;7.11</p><p>Financial</p>").split() == ["Section", "7.11", "Financial"]
