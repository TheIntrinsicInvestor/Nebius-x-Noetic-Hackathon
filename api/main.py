import json
import os
import shutil
from datetime import datetime
from pathlib import Path

import logging
import time

import openai
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.cases import DATA, STATE, UPLOADS, load_budget, load_case
from api.copilot import ask
from api.engine.headroom import Analysis, analyze
from api.explain import make_insights
from api.extract_agreement import extract_covenants
from api.locate import html_to_text
from api.market import market_context
from api.models import CovenantSet, Quarter, Scenario
from api.extract_financials import map_lines
from api.llm import PRIMARY_MODEL, SECOND_MODEL
from api.pdf import pdf_text
from api.ratelimit import rate_limit
from api.upload import build_budget, build_quarters, read_table, save_case, slug

ROOT = Path(__file__).resolve().parent.parent
BOFA_LAST_TEST = "2025-12-31"
RETRY_PAUSE_S = 3
MODEL_SERVICE ="Open model on Nebius Token Factory (deployable in your own environment)"
CACHE = STATE / "cache"
OUTBOUND_LOG = CACHE / "outbound_log.json"
RATE_FILE = STATE / "ratelimit.json"
# hosted front end origins, comma-separated (e.g. the Vercel URL)
ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] + [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


def seed_state(seed: Path, state: Path) -> None:
    """A fresh hosted volume starts with the showcase case and its caches (seed/); never overwrites."""
    for src in seed.rglob("*"):
        dst = state / src.relative_to(seed)
        if src.is_file() and not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)


seed_state(ROOT / "seed", STATE)

log = logging.getLogger("uvicorn.error")
app = FastAPI(title="NorthStar")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])


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
def post_analyze(req: AnalyzeRequest, request: Request):
    qs, cs, meta = _case(req.case)
    qs = req.quarters if req.quarters is not None else qs
    cs = req.covenants or cs
    try:
        a = analyze(qs, cs, req.scenario, budget=load_budget(req.case))
    except ValueError as e:
        raise HTTPException(422, str(e))
    insights, cached = [], False
    if req.insights:
        is_default = req.covenants is None and req.quarters is None and req.scenario == Scenario()
        path = CACHE / f"{req.case}_insights.json"
        if is_default and path.exists():
            insights, cached = json.loads(path.read_text(encoding="utf-8")), True
        else:
            rate_limit(request, RATE_FILE)
            log_outbound(MODEL_SERVICE, "insight cards from the analysis summary")
            insights = [i.model_dump() for i in with_fallback(make_insights, insight_payload(a, meta, req.scenario))]
            if is_default:
                CACHE.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(insights, indent=1), encoding="utf-8")
    return {"analysis": a, "insights": insights, "cached": cached}


AGREEMENT_TYPES = (".pdf", ".txt", ".htm", ".html")
TABLE_TYPES = (".xlsx", ".pdf")


def agreement_text(filename: str, data: bytes) -> str:
    """Plain text of an agreement upload; raises ValueError for a scanned PDF."""
    name = filename.lower()
    if name.endswith(".pdf"):
        return pdf_text(data)
    raw = data.decode("utf-8", errors="replace")
    return html_to_text(raw) if name.endswith((".htm", ".html")) else raw


@app.post("/agreement")
async def post_agreement(file: UploadFile, request: Request):
    name = (file.filename or "").lower()
    if not name.endswith(AGREEMENT_TYPES):
        raise HTTPException(415, "upload the credit agreement as .pdf, .htm or .txt")
    data = await file.read()
    try:
        text = agreement_text(name, data)
        rate_limit(request, RATE_FILE)
        log_outbound(MODEL_SERVICE, f"covenant extraction from {file.filename}")
        cs, stats = with_fallback(extract_covenants, text)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"covenants": cs, "stats": stats.__dict__}


@app.post("/company")
async def post_company(request: Request, agreement: UploadFile, financials: UploadFile,
                       budget: UploadFile | None = None,
                       name: str = Form(...), sector: str = Form(""),
                       country: str = Form(""), lender: str = Form(""), currency: str = Form("$"),
                       unit: str = Form("thousands")):
    """Upload a credit agreement and management accounts; both are read by the open model and saved as a case."""
    a_name, f_name = (agreement.filename or "").lower(), (financials.filename or "").lower()
    if not a_name.endswith(AGREEMENT_TYPES):
        raise HTTPException(415, "upload the credit agreement as .pdf, .htm or .txt")
    if not f_name.endswith(TABLE_TYPES):
        raise HTTPException(415, "upload the management accounts as .xlsx or .pdf")
    b_name = (budget.filename or "").lower() if budget else ""
    if budget and not b_name.endswith(TABLE_TYPES):
        raise HTTPException(415, "upload the budget as .xlsx or .pdf")
    a_data = await agreement.read()
    data = await financials.read()
    b_data = await budget.read() if budget else None
    try:
        # read every file before any outbound call, so a scanned or malformed upload costs nothing
        text = agreement_text(a_name, a_data)
        cols, lines = read_table(data, f_name)
        b_cols, b_lines = read_table(b_data, b_name) if b_data else ([], [])
        rate_limit(request, RATE_FILE)
        log_outbound(MODEL_SERVICE, f"covenant extraction from {agreement.filename}")
        files = financials.filename + (f" and {budget.filename}" if budget else "")
        log_outbound(MODEL_SERVICE, f"account line names from {files} (names only, no amounts)")
        names = list(dict.fromkeys(n for n, _ in lines + b_lines))  # one mapping call covers both files
        cs, a_stats = with_fallback(extract_covenants, text)
        mapping, f_stats = with_fallback(map_lines, names)
        qs = build_quarters(cols, lines, mapping, unit)
        plan = build_budget(b_cols, b_lines, mapping, unit, qs[-1].period_end) if b_data else None
    except ValueError as e:
        raise HTTPException(422, str(e))
    case = slug(name)
    meta = {"name": case, "display_name": name.strip(), "currency": currency, "unit": "m", "sector": sector,
            "country": country, "lender": lender, "base_rate": cs.facility.base_rate_name or "",
            "description": f"Uploaded {datetime.now():%d %b %Y}: {agreement.filename} and {financials.filename}, "
                           f"{len(qs)} quarters to {qs[-1].period_end:%b %Y}."}
    save_case(UPLOADS, case, qs, cs, meta, mapping, plan)
    for stale in (CACHE / f"{case}_insights.json", CACHE / f"market_{case}.json"):
        stale.unlink(missing_ok=True)
    return {"case": case, "covenants": cs, "mapping": mapping, "quarters": len(qs),
            "budget_quarters": len(plan) if plan else 0,
            "budget_until": plan[-1].period_end if plan else None,
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
def post_ask(req: AskRequest, request: Request):
    _case(req.case)
    rate_limit(request, RATE_FILE)
    log_outbound(MODEL_SERVICE, "copilot question with engine tool results")
    return with_fallback(ask, req.case, req.question, req.covenants)


@app.get("/market/{name}")
def get_market(name: str, request: Request):
    _, _, meta = _case(name)
    path = CACHE / f"market_{name}.json"
    if path.exists():
        return {"items": json.loads(path.read_text(encoding="utf-8")), "cached": True}
    rate_limit(request, RATE_FILE)
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
