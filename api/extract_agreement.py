"""Credit agreement text -> CovenantSet, via an open model with JSON-schema output."""
from api.llm import PRIMARY_MODEL, CallStats, chat_json
from api.locate import Chunk, locate_sections
from api.models import CovenantSet

SYSTEM = """You are a leveraged-finance analyst reading a credit agreement or an amendment to one.
Extract the FINANCIAL covenants exactly as they stand after this document.
Rules:
- Only use what the text states. Use null for anything not stated. Never guess numbers.
- kind: leverage (debt / EBITDA, max), interest_cover (EBITDA / interest, min),
  fixed_charge_cover (min), min_ebitda (minimum EBITDA amount, min). Skip other covenants (e.g. liquidity).
- comparator: "max" if the ratio must not exceed the level, "min" if it must not fall below it.
- threshold: the first level that applies (a number, e.g. 2.5 for "2.50 to 1.00"; full currency amount for EBITDA, e.g. 1600000).
- step_downs: every later level with the date it starts applying (ISO dates).
- effective_from: the first test date if the text says the covenant starts later (e.g. "beginning with the fiscal quarter ending ..."), else null.
- measurement_quarters: 4 for trailing four quarters unless the text defines a shorter period.
- nets_cash: true only if the debt measure subtracts cash.
- addbacks: short names of items added back to EBITDA in its definition; addback_cap_pct as a fraction if capped.
- source_quote: a verbatim quote (max 300 characters) from the text that states the covenant level.
- facility: total commitment amount, maturity date, interest margin in percent, base rate name, each with a source_quote."""


def build_prompt(chunks: list[Chunk]) -> tuple[str, str]:
    body = "\n\n".join(f"### {c.title}\n{c.text}" for c in chunks)
    return SYSTEM, f"Credit agreement excerpts:\n\n{body}"


def extract_covenants(text: str, model: str = PRIMARY_MODEL) -> tuple[CovenantSet, CallStats]:
    chunks = locate_sections(text)
    if not chunks:
        raise ValueError("no covenant section found in document")
    system, user = build_prompt(chunks)
    data, stats = chat_json(model, system, user, CovenantSet.model_json_schema(), "covenant_set")
    return CovenantSet.model_validate(data), stats
