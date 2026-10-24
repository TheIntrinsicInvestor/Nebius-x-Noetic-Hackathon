"""Ask-a-question copilot: the open model calls the deterministic engine as a tool and explains the result."""
import json
import time

from api.cases import load_case
from api.engine.headroom import analyze
from api.explain import allowed_numbers, validate_numbers
from api.llm import PRIMARY_MODEL, PRICES, _client
from api.models import Scenario


def _quarter(d) -> str:
    return f"Q{(d.month - 1) // 3 + 1} {d.year}"


def run_scenario_tool(case: str, args: dict) -> dict:
    qs, cs, meta = load_case(case)
    sc = Scenario(**{k: float(v) for k, v in args.items() if k in Scenario.model_fields})
    a = analyze(qs, cs, sc)
    lows = {}
    for p in a.points:
        if p.is_forecast and (p.kind not in lows or p.headroom_pct < lows[p.kind]["headroom_pct"]):
            lows[p.kind] = {"quarter": _quarter(p.period_end), "value": round(p.value, 2),
                            "limit": p.threshold, "headroom_pct": round(p.headroom_pct, 3)}
    fb = a.first_breach
    return {
        "scenario": sc.model_dump(),
        "first_breach": {"kind": fb.kind, "quarter": _quarter(fb.period_end), "value": round(fb.value, 2),
                         "limit": fb.threshold} if fb else None,
        "lowest_headroom": lows,
        "reverse_stress": a.reverse_stress,
        "currency": meta["currency"] + "m",
    }


TOOLS = [{
    "type": "function",
    "function": {
        "name": "run_scenario",
        "description": "Re-run the covenant forecast under a what-if scenario and return the first projected breach, "
                       "the lowest headroom per covenant over the next 6 quarters, and how far EBITDA or customer "
                       "payment days can slip. All arguments are optional changes versus the base case.",
        "parameters": {"type": "object", "properties": {
            "revenue_pct": {"type": "number", "description": "revenue change as a fraction, e.g. -0.1 for -10%"},
            "ebitda_pct": {"type": "number", "description": "EBITDA margin change as a fraction"},
            "dso_delta": {"type": "number", "description": "extra days customers take to pay"},
            "dio_delta": {"type": "number", "description": "extra days of inventory held"},
            "capex_extra": {"type": "number", "description": "extra capex or R&D spend in currency millions, spread over the next 4 quarters"},
            "rate_bp": {"type": "number", "description": "interest rate change in basis points"},
        }},
    },
}]

SYSTEM = """You help a finance director at a mid-sized company understand their loan covenants.
Always call run_scenario (with no arguments for the base case, and with arguments for any what-if in the question)
before answering. Answer in at most 90 words, plain English, using ONLY numbers returned by the tool or stated in
the question. Say clearly whether the plan breaches a covenant and when, and suggest one safer alternative if it does
(you may call run_scenario again to test it). No em dashes."""


def ask(case: str, question: str, model: str = PRIMARY_MODEL) -> dict:
    client = _client()
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    calls, results, tokens_in, tokens_out = [], [], 0, 0
    t0 = time.perf_counter()
    for _ in range(4):
        resp = client.chat.completions.create(model=model, messages=messages, tools=TOOLS, temperature=0)
        tokens_in += resp.usage.prompt_tokens
        tokens_out += resp.usage.completion_tokens
        msg = resp.choices[0].message
        if not msg.tool_calls:
            answer = msg.content or ""
            allowed = allowed_numbers(results) | allowed_numbers({"q": [float(x) for x in
                                                                  __import__("re").findall(r"\d+\.?\d*", question)]})
            pin, pout = PRICES.get(model, (0.0, 0.0))
            return {"answer": answer, "tool_calls": calls, "unverified_numbers": validate_numbers(answer, allowed),
                    "latency_s": round(time.perf_counter() - t0, 1),
                    "cost_usd": (tokens_in * pin + tokens_out * pout) / 1e6, "model": model}
        messages.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            result = run_scenario_tool(case, args)
            calls.append({"name": tc.function.name, "args": args})
            results.append(result)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
    return {"answer": "I could not finish the analysis. Try a simpler question.", "tool_calls": calls,
            "unverified_numbers": [], "latency_s": round(time.perf_counter() - t0, 1), "cost_usd": 0.0, "model": model}
