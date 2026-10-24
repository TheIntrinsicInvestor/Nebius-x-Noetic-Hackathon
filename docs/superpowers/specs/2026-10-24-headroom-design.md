# NorthStar (working name Headroom): design spec (2026-10-24)

Covenant early warning for mid-sized companies without a PE sponsor. Built for the Noetic x Nebius hackathon (judging 16:30 today). Full research and sources: the hackathon folder's plan file (`C:\Users\Brian\.claude\plans\pasted-content-id-6c20-the-story-agile-bachman.md`).

## Intent
- **User:** an accountant or fractional finance director serving several mid-sized, non-PE-backed clients with bank debt. The company's finance director is the secondary user.
- **Problem:** these firms carry financial covenants (leverage, interest cover, fixed charge cover, minimum EBITDA) tested quarterly, but have no FP&A team, no treasury system and no sponsor finance team. Breaches arrive without warning and cost fees, higher margins and cut facilities. Nortech's Q4 2025 waiver cost 0.25% of debt, cut its revolver from $15m to $12m, and moved it to SOFR + 3.50%.
- **Success at the hackathon:** a live demo on real inputs (Nortech filings), a working what-if, and a benchmark table comparing open vs closed models on accuracy, cost and speed.

## Pitch line
Lead with **cost and control**: open models match Claude on this task at a fraction of the cost, and can run on infrastructure the firm controls. Mention privacy as full control. Never claim closed models are unsafe (Claude on Bedrock offers zero data retention).

## Approach
The engine comes first: LLMs read, classify and explain, and deterministic Python computes every number. Two stretch features: a chat copilot (function calling) and a Tavily market panel.

## Components (backend: `api/`, Python 3.11, FastAPI)
| Unit | Does | Depends on |
|---|---|---|
| `llm.py` | Token Factory client (OpenAI SDK, `https://api.tokenfactory.nebius.com/v1/`, `NEBIUS_API_KEY`); `json_schema` structured output; logs tokens, latency and cost per call | `.env` |
| `locate.py` | Finds the financial-covenant section and the definitions needed (Consolidated EBITDA, Leverage Ratio, Fixed Charge Coverage Ratio, Interest Coverage Ratio, Net Debt) in agreement text by regex/heading search, and returns the chunks | none |
| `extract_agreement.py` | Chunks to `CovenantSet` JSON: per covenant: kind, comparator, threshold, step-downs, test frequency, measurement period, EBITDA add-backs and caps, cash netting, equity cure; facility: size, maturity, margin. Every field carries `source_quote` | `llm`, `locate` |
| `extract_financials.py` | Management accounts XLSX/CSV lines to a standard chart (revenue, COGS, opex, D&A, interest, cash, debt, receivables, inventory, payables, capex) with confidence; flags low-confidence lines; sanity checks (balance sheet balances) | `llm` |
| `edgar.py` | Nortech quarterly history from SEC XBRL `companyfacts` (`SEC_USER_AGENT` from `.env`); cached to `data/nortech/` | none |
| `engine/covenants.py` | LTM EBITDA (with add-backs listed as separate lines), net debt, ratios per test date | none |
| `engine/forecast.py` | Driver-based quarterly projection for 6 quarters: seasonal revenue, trailing margins, receivable/inventory/supplier days, debt schedule, interest = debt × (base + margin) | none |
| `engine/headroom.py` | Headroom % per covenant per date, first breach, binding covenant, reverse stress test (max EBITDA fall / max receivable-day rise before breach, by bisection) | covenants, forecast |
| `engine/scenarios.py` | Applies deltas (receivable days, inventory days, revenue %, capex £, rate bp) and re-runs | forecast, headroom |
| `engine/refi.py` | Months to maturity, interest cover at a repriced rate, start-talks date (maturity minus 12 months), cost-of-breach estimate | covenants |
| `explain.py` | Model writes 3-5 insight cards from engine JSON; a validator rejects any number not in the input | `llm` |
| `market.py` *(stretch)* | Tavily queries built only from public metadata (sector, country, lender); every query logged | Tavily key |
| `copilot.py` *(stretch)* | Function calling over `run_scenario` / `get_headroom` | `llm`, engine |
| `main.py` | `POST /agreement`, `POST /financials`, `POST /analyze`, `POST /scenario`, `GET /benchmark`, `GET /cases/{name}`; results cached in `data/cache/` | all |

## Frontend (`web/`, Next.js App Router + Tailwind + Recharts), one page, 4 steps
1. **Upload:** agreement + financials, or "Load Nortech case".
2. **Review:** covenant table with each clause quote beside its field; flagged account mappings.
3. **Dashboard:** headroom chart (threshold line, step-downs, breach marker), first-breach banner, insight cards, what-if sliders (receivable days, revenue %, capex, rate), refinancing countdown, outbound data log.
4. **Open vs Closed:** benchmark table + error examples.

## Data
- **Nortech (primary, real):** original BofA credit agreement + amendments from EDGAR (teammates locate them); 10-K/10-Q XBRL; per-quarter "in compliance" statements from the 10-Qs as the correct answers for the backtest.
- **Synthetic UK client pack:** ~£40m-revenue family manufacturer, RCF + term loan, leverage ≤ 3.0x, interest cover ≥ 3.0x, quarterly; messy monthly management-accounts XLSX with odd account names and one add-back trap.
- **Stretch:** one Companies House set of full accounts for a UK private company with bank loans.

## Benchmark
- **Task A:** covenant extraction on 6-10 EDGAR agreements; identical located chunks go to each model; teammates hand-label the correct answers.
- **Task B:** account mapping on ~60 labelled messy lines.
- **Models:** DeepSeek-V4.1-Flash + one other open model with JSON mode (confirm via `models.list()`) vs Claude via fresh Claude Code subagents (prompt + chunks only, no labels).
- **Metrics:** field accuracy; cost per document (open: real usage; Claude: token estimate × published price); latency (open only; disclosed).

## Error handling
- A covenant field that can't be extracted shows "not found, enter manually" with the field still editable. The engine refuses to compute a covenant that is missing a threshold.
- An LLM call that fails schema validation is retried once, then the field is flagged.
- The API falls back to cached results; the UI shows "cached" vs "live".

## Testing / verification
- `pytest` for the engine with hand-calculated fixtures (ratios, headroom, first breach, reverse stress).
- CLI `python -m api.cli analyze --case nortech` prints covenants with quotes and the per-quarter headroom vs the 10-Q compliance statements.
- `curl` every endpoint; Playwright screenshots of the 4 steps; two timed full demo runs before 16:15.

## Out of scope
Receipts and scanned images, bank or accounting-software connectors, compliance-certificate drafting, Monte Carlo, multi-client portfolio view (pitch slide only), auth.

## Risks
- Nortech's original thresholds may be scattered across documents. Fallback: the minimum EBITDA covenant from amendment 4.
- The backtest may not show an early flag. The narrative is decided at ~14:00 from the actual numbers.
- Two codebases in ~3.5h: backend CLI first, freeze at 16:00, cached demo, backup video.
- The rate figures for slides must be checked against BoE and Fed sources.
- Secrets live only in `.env` (repo outside OneDrive, gitignored).
