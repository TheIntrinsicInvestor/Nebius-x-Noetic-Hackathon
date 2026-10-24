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
PROSE_RE = re.compile(r"(?i)(leverage ratio|coverage ratio|minimum (?:consolidated )?ebitda)")
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
    # candidates: covenant headings, and ratio mentions (prose 8-Ks have no heading; small caps break headings)
    starts = {m.start() for m in COVENANT_RE.finditer(text)}
    starts |= {max(0, m.start() - 1500) for m in PROSE_RE.finditer(text)}

    def score(s: int) -> int:
        window = text[s: s + COVENANT_CHARS]
        operative = len(re.findall(r"(?i)\bpermit\b|shall not (?:permit|exceed|be)|may not (?:exceed|be)", window))
        levels = len(re.findall(r"(?i)\d\.\d{1,2}\s*(?:to|:)\s*1(?:\.0{1,2})?\b", window))
        blanks = window.count("$___")  # compliance-certificate forms are full of blanks
        return operative * 3 + levels * 4 - blanks

    if starts:
        best = max(sorted(starts), key=score)
        chunks.append(Chunk("covenants", text[best: best + COVENANT_CHARS]))
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
