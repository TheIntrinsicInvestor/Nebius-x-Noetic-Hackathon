"""Find the covenant section and the definitions it depends on, so only those chunks go to a model."""
import re
from dataclasses import dataclass

from bs4 import BeautifulSoup

COVENANT_RE = re.compile(r"(?i)(financial covenants|section\s+7\.11|7\.11\s)")
DEF_NAMES = ("Consolidated EBITDA|Consolidated Leverage Ratio|Total Leverage Ratio|Fixed Charge Coverage Ratio|"
             "Consolidated Fixed Charge Coverage Ratio|Consolidated Interest Coverage Ratio|Interest Coverage Ratio|"
             "Consolidated Net Debt|Maturity Date|Applicable Rate|Revolving Commitment|Measurement Period")
DEF_RE = re.compile(r'(?i)[“"](' + DEF_NAMES + r')[”"]\s+(?:means|shall mean)')
ANY_DEF_RE = re.compile(r'[“"][A-Z][^”"]{1,80}[”"]\s+(?:means|shall mean|has the meaning)')
COVENANT_CHARS = 8000
DEF_CHARS = 4000


@dataclass
class Chunk:
    title: str
    text: str


def html_to_text(html: str) -> str:
    text = BeautifulSoup(html, "lxml").get_text(" ")
    text = re.sub(r"\s+", " ", text.replace("\xa0", " "))
    # quoted terms often arrive as “ Consolidated EBITDA ” after tag stripping
    return re.sub(r"([“\"]) ?([^“”\"]{1,80}?) ?([”\"])", r"\1\2\3", text).strip()


def locate_sections(text: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    # last "Financial Covenants" hit is usually the operative section, not the table of contents
    hits = [m for m in COVENANT_RE.finditer(text)]
    if hits:
        def score(m: re.Match) -> int:
            window = text[m.start(): m.start() + COVENANT_CHARS]
            operative = len(re.findall(r"(?i)\bpermit\b|shall not (?:permit|be)", window))
            blanks = window.count("$___")  # compliance-certificate forms are full of blanks
            return operative * 3 + len(re.findall(r"(?i)to\s+1\.00|:1\.0", window)) - blanks
        best = max(hits, key=score)
        chunks.append(Chunk("covenants", text[best.start(): best.start() + COVENANT_CHARS]))
    seen = set()
    for m in DEF_RE.finditer(text):
        name = m.group(1)
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        nxt = ANY_DEF_RE.search(text, m.end())
        end = min(nxt.start() if nxt else len(text), m.start() + DEF_CHARS)
        chunks.append(Chunk(name, text[m.start(): end].strip()))
    return chunks
