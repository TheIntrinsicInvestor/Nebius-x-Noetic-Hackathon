import json
from datetime import datetime
from pathlib import Path

import logging
import time

import openai
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.cases import DATA, UPLOADS, load_case
from api.copilot import ask
from api.engine.headroom import Analysis, analyze
from api.explain import make_insights
from api.extract_agreement import extract_covenants
from api.locate import html_to_text
from api.market import market_context
from api.models import CovenantSet, Quarter, Scenario
from api.extract_financials import map_lines
from api.llm import PRIMARY_MODEL, SECOND_MODEL
from api.upload import build_quarters, read_sheet, save_case, slug

ROOT = Path(__file__).resolve().parent.parent
BOFA_LAST_TEST = "2025-12-31"
RETRY_PAUSE_S = 3
MODEL_SERVICE ="Open model on Nebius Token Factory (deployable in your own environment)"
CACHE = DATA / "cache"
OUTBOUND_LOG = CACHE / "outbound_log.json"

log = logging.getLogger("uvicorn.error")
app = FastAPI(title="NorthStar")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(openai.APIError)
def model_service_error(_, e: openai.APIError):
    # handled here (inside CORS middleware) so the browser sees the message, not a CORS failure
    log.warning("model service error: %r", e)
    return JSONResponse(status_code=502, content={
        "detail": "The open model service (Nebius Token Factory) is temporarily unavailable. Try again in a moment."})


DEFINITIONS = {
    "leverage": "debt (net of cash if the agreement says so) / EBITDA over the last 4 quarters; must stay below the limit",
    "interest_cover": "EBITDA / interest over the last 4 quarters; must stay above the limit",
    "fixed_charge_cover": "(EBITDA - capex) / (interest + scheduled debt repayments); must stay above the limit",
    "min_ebitda": "EBITDA over the measurement period; must stay above the amount",
    "headroom_pct": "share of the limit left before a breach; negative means breached",
    "reverse_stress.ebitda_fall_pct": "largest EBITDA fall with no projected breach (0 means already breaching)",
    "reverse_stress.dso_days": "how many days later customers can pay with no projected breach",
    "value 999": "ratio undefined because EBITDA is zero or negative",
}


class AnalyzeRequest(BaseModel):
    case: str
    covenants: CovenantSet | None = None
    quarters: list[Quarter] | None = None
    scenario: Scenario = Scenario()
    insights: bool = False


def _case(name: str):
    try:
        return load_case(name)
    except KeyError:
        raise HTTPException(404, f"unknown case {name}")


def with_fallback(fn, *args, **kw):
    """App calls only (not the benchmark): if the primary open model errors or returns nothing, alternate with the
    second one. Token Factory 503s come in bursts of ~20 s, so pause between rounds."""
    for i, model in enumerate([PRIMARY_MODEL, SECOND_MODEL, PRIMARY_MODEL, SECOND_MODEL]):
        try:
            return fn(*args, model=model, **kw)
        except (openai.APIError, ValueError) as e:
            log.warning("%s failed on %s (attempt %d): %r", getattr(fn, "__name__", fn), model, i + 1, e)
            if i == 3:
                raise
            time.sleep(RETRY_PAUSE_S)


def insight_payload(a: Analysis, meta: dict, sc: Scenario) -> dict:
    """Trimmed analysis for the model: latest actual point per covenant, forecast low point, breach, stress, refi."""
    actual = [p for p in a.points if not p.is_forecast]
    latest = {p.kind: p for p in actual}
    fc = [p for p in a.points if p.is_forecast]
    lows = {}
    for p in fc:
        if p.kind not in lows or p.headroom_pct < lows[p.kind].headroom_pct:
            lows[p.kind] = p
    payload = {
        "company": meta["display_name"], "currency": meta["currency"] + "m",
        "today": actual[-1].period_end.isoformat() if actual else None,
        "definitions": DEFINITIONS,
        "latest_actual": [p.model_dump(mode="json") for p in latest.values()],
        "forecast_low_point": [p.model_dump(mode="json") for p in lows.values()],
        "first_breach": a.first_breach.model_dump(mode="json") if a.first_breach else None,
        "binding_covenant": a.binding_kind,
        "reverse_stress": a.reverse_stress,
        "refinancing": json.loads(json.dumps(a.refi, default=str)),
    }
    if sc != Scenario():
        payload["scenario"] = sc.model_dump()
    return payload


@app.get("/cases/{name}")
def get_case(name: str):
    qs, cs, meta = _case(name)
    return {"quarters": qs, "covenants": cs, "meta": meta}


@app.post("/analyze")
def post_analyze(req: AnalyzeRequest):
    qs, cs, meta = _case(req.case)
    qs = req.quarters if req.quarters is not None else qs
    cs = req.covenants or cs
    try:
        a = analyze(qs, cs, req.scenario)
    except ValueError as e:
        raise HTTPException(422, str(e))
    insights, cached = [], False
    if req.insights:
        is_default = req.covenants is None and req.quarters is None and req.scenario == Scenario()
        path = CACHE / f"{req.case}_insights.json"
        if is_default and path.exists():
            insights, cached = json.loads(path.read_text(encoding="utf-8")), True
        else:
            log_outbound(MODEL_SERVICE, "insight cards from the analysis summary")
            insights = [i.model_dump() for i in with_fallback(make_insights, insight_payload(a, meta, req.scenario))]
            if is_default:
                CACHE.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(insights, indent=1), encoding="utf-8")
    return {"analysis": a, "insights": insights, "cached": cached}


@app.post("/agreement")
async def post_agreement(file: UploadFile):
    name = (file.filename or "").lower()
    if not name.endswith((".txt", ".htm", ".html")):
        raise HTTPException(415, "upload a .txt or .htm credit agreement")
    raw = (await file.read()).decode("utf-8", errors="replace")
    text = html_to_text(raw) if name.endswith((".htm", ".html")) else raw
    log_outbound(MODEL_SERVICE, f"covenant extraction from {file.filename}")
    try:
        cs, stats = with_fallback(extract_covenants, text)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"covenants": cs, "stats": stats.__dict__}


@app.post("/company")
async def post_company(agreement: UploadFile, financials: UploadFile, name: str = Form(...), sector: str = Form(""),
                       country: str = Form(""), lender: str = Form(""), currency: str = Form("$"),
                       unit: str = Form("thousands")):
    """Upload a credit agreement and management accounts; both are read by the open model and saved as a case."""
    a_name, f_name = (agreement.filename or "").lower(), (financials.filename or "").lower()
    if not a_name.endswith((".txt", ".htm", ".html")):
        raise HTTPException(415, "upload the credit agreement as .htm or .txt")
    if not f_name.endswith(".xlsx"):
        raise HTTPException(415, "upload the management accounts as .xlsx")
    raw = (await agreement.read()).decode("utf-8", errors="replace")
    text = html_to_text(raw) if a_name.endswith((".htm", ".html")) else raw
    data = await financials.read()
    log_outbound(MODEL_SERVICE, f"covenant extraction from {agreement.filename}")
    log_outbound(MODEL_SERVICE, f"account line names from {financials.filename} (names only, no amounts)")
    try:
        cols, lines = read_sheet(data)
        cs, a_stats = with_fallback(extract_covenants, text)
        mapping, f_stats = with_fallback(map_lines, [n for n, _ in lines])
        qs = build_quarters(cols, lines, mapping, unit)
    except ValueError as e:
        raise HTTPException(422, str(e))
    case = slug(name)
    meta = {"name": case, "display_name": name.strip(), "currency": currency, "unit": "m", "sector": sector,
            "country": country, "lender": lender, "base_rate": cs.facility.base_rate_name or "",
            "description": f"Uploaded {datetime.now():%d %b %Y}: {agreement.filename} and {financials.filename}, "
                           f"{len(qs)} quarters to {qs[-1].period_end:%b %Y}."}
    save_case(UPLOADS, case, qs, cs, meta, mapping)
    for stale in (CACHE / f"{case}_insights.json", CACHE / f"market_{case}.json"):
        stale.unlink(missing_ok=True)
    return {"case": case, "covenants": cs, "mapping": mapping, "quarters": len(qs),
            "stats": {"agreement": a_stats.__dict__, "financials": f_stats.__dict__}}


def backtest_rows() -> list[dict]:
    qs, cs, _ = load_case("nortech", full=True)
    truth = {r["period_end"]: r for r in json.loads((DATA / "nortech" / "compliance.json").read_text(encoding="utf-8"))}
    rows = []
    for i, q in enumerate(qs):
        # BofA covenants applied from 2024 until the Mar 2026 refinancing with Associated Bank
        if q.period_end.year < 2024 or q.period_end.isoformat() > BOFA_LAST_TEST:
            continue
        a = analyze(qs[: i + 1], cs, n=4)
        t = truth.get(q.period_end.isoformat())
        rows.append({
            "as_of": q.period_end.isoformat(),
            "current": [p for p in a.points if p.period_end == q.period_end],
            "predicted_first_breach": a.first_breach,
            "actual_in_compliance": t["in_compliance"] if t else None,
            "quote": t["quote"] if t else None,
            "note": t.get("note") if t else None,
        })
    return rows


@app.get("/backtest/nortech")
def get_backtest():
    return {"rows": backtest_rows()}


@app.get("/benchmark")
def get_benchmark():
    p = ROOT / "bench" / "results.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"rows": [], "errors": {}}


class AskRequest(BaseModel):
    case: str
    question: str
    covenants: CovenantSet | None = None


@app.post("/ask")
def post_ask(req: AskRequest):
    _case(req.case)
    log_outbound(MODEL_SERVICE, "copilot question with engine tool results")
    return with_fallback(ask, req.case, req.question, req.covenants)


@app.get("/market/{name}")
def get_market(name: str):
    _, _, meta = _case(name)
    path = CACHE / f"market_{name}.json"
    if path.exists():
        return {"items": json.loads(path.read_text(encoding="utf-8")), "cached": True}
    items = market_context(meta, log_outbound)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, indent=1), encoding="utf-8")
    return {"items": items, "cached": False}


@app.get("/outbound")
def get_outbound():
    calls = json.loads(OUTBOUND_LOG.read_text(encoding="utf-8")) if OUTBOUND_LOG.exists() else []
    return {"calls": calls}


def log_outbound(service: str, query: str) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    calls = json.loads(OUTBOUND_LOG.read_text(encoding="utf-8")) if OUTBOUND_LOG.exists() else []
    calls.append({"time": datetime.now().isoformat(timespec="seconds"), "service": service, "query": query})
    OUTBOUND_LOG.write_text(json.dumps(calls, indent=1), encoding="utf-8")
