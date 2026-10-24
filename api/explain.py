"""Plain-English insight cards written by an open model, with every number checked against engine output."""
import re
from datetime import date
from typing import Any

from pydantic import BaseModel

from api.llm import PRIMARY_MODEL, chat_json

NUM_RE = re.compile(r"\d[\d,]*\.?\d*")


class Insight(BaseModel):
    title: str
    body: str


class _Insights(BaseModel):
    insights: list[Insight]


def _add(v: float, out: set[float]) -> None:
    for x in (v, abs(v)):
        out.update({round(x, 0), round(x, 1), round(x, 2)})
        if abs(x) <= 1:
            out.update({round(x * 100, 0), round(x * 100, 1)})


def allowed_numbers(obj: Any) -> set[float]:
    out: set[float] = set(float(i) for i in range(0, 13))  # small counts (quarters, months)

    def walk(o: Any) -> None:
        if isinstance(o, bool) or o is None:
            return
        if isinstance(o, (int, float)):
            _add(float(o), out)
        elif isinstance(o, date):
            out.update({float(o.year), float((o.month - 1) // 3 + 1), float(o.month), float(o.day)})
        elif isinstance(o, str):
            try:
                walk(date.fromisoformat(o))
            except ValueError:
                pass
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)
        elif isinstance(o, BaseModel):
            walk(o.model_dump())

    walk(obj)
    return out


def validate_numbers(text: str, allowed: set[float]) -> list[str]:
    bad = []
    for tok in NUM_RE.findall(text):
        clean = tok.replace(",", "").rstrip(".")
        if not clean:
            continue
        if float(clean) not in allowed:
            bad.append(clean)
    return bad


SYSTEM = """You are a corporate finance adviser writing for a busy finance director with no treasury team.
From the JSON analysis, write 3 to 5 short insight cards (title max 8 words, body max 45 words).
Cover: how much warning they have before the first breach, which covenant binds first, how far EBITDA
or customer payment days can slip before a breach, the effect of the scenario if one is applied, and
refinancing timing. Use ONLY numbers that appear in the JSON (you may round them or show fractions as percentages).
Quarters are written like "Q3 2027". No em dashes. Plain English, no jargon without explanation."""


def make_insights(payload: dict, model: str = PRIMARY_MODEL) -> list[Insight]:
    import json
    data, _ = chat_json(model, SYSTEM, json.dumps(payload, default=str),
                        _Insights.model_json_schema(), "insights")
    allowed = allowed_numbers(payload)
    out = []
    for ins in _Insights.model_validate(data).insights:
        if not validate_numbers(ins.title + " " + ins.body, allowed):
            out.append(ins)
    return out
