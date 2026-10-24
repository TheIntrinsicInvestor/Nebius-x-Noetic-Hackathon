"""PDF uploads, read deterministically: agreement text, and account tables for the engine.

No model ever sees or produces a number from a PDF: tables are extracted by pdfplumber and every cell must
parse exactly, or the upload is refused with a readable error.
"""
import io
import re

import pdfplumber

SCANNED = "this PDF looks scanned: it has no text layer, and NorthStar does not read images. Upload a text PDF instead"
_NUMBER = re.compile(r"-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?")
_DASHES = ("", "-", "–", "—")


def parse_number(v) -> float:
    """Accounting-style cell -> float: '1,234.5', '(56.2)' negative, '-' zero, a leading currency symbol."""
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    neg = s.startswith("(") and s.endswith(")")
    if neg:
        s = s[1:-1].strip()
    s = re.sub(r"^[£$€]\s*", "", s)
    if s in _DASHES:
        return 0.0
    if not _NUMBER.fullmatch(s):
        raise ValueError(f"'{v}' is not a number")
    x = float(s.replace(",", ""))
    return -x if neg else x


def _open(data: bytes):
    try:
        return pdfplumber.open(io.BytesIO(data))
    except Exception as e:  # pdfminer raises its own types for damaged or mislabelled files
        raise ValueError(f"could not read this PDF ({e}). Check the file opens, or upload another format") from None


def pdf_text(data: bytes) -> str:
    with _open(data) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    if not text.strip():
        raise ValueError(SCANNED + ", .htm or .txt")
    return text


def pdf_rows(data: bytes) -> list[list]:
    """All tables in the PDF as one grid (header row first), like a spreadsheet's rows.

    A wide sheet printed across pages repeats the account names on each page: its columns are joined.
    A long sheet repeats the date header: its rows are joined. Anything else is refused.
    """
    with _open(data) as pdf:
        if not any((p.extract_text() or "").strip() for p in pdf.pages):
            raise ValueError(SCANNED + " or .xlsx")
        tables = [[[" ".join(c.split()) if c else c for c in row] for row in t]
                  for p in pdf.pages for t in p.extract_tables() if t and len(t) >= 2]
    if not tables:
        raise ValueError("found no table in this PDF: the accounts need a table with account names down the side "
                         "and months or quarters across")
    grid = [list(r) for r in tables[0]]
    for t in tables[1:]:
        if [r[0] for r in t[1:]] == [r[0] for r in grid[1:]]:
            for row, more in zip(grid, t):
                row.extend(more[1:])
        elif t[0] == grid[0]:
            grid.extend(t[1:])
        else:
            raise ValueError("the tables on different pages do not line up: each page must repeat either the account "
                             "names or the date header")
    return grid
