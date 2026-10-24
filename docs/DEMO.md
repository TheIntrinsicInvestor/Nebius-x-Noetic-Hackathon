# NorthStar: demo script and pitch numbers

Every number below was produced by the running code today (24 Oct 2026) or quoted from a filing. Sources are in brackets.

## Run it
1. API: `C:\Users\Brian\.venvs\headroom\Scripts\python -m uvicorn api.main:app --port 8000` (from `C:\Users\Brian\code\headroom`)
2. Web: `npm run dev` in `web\`, open http://localhost:3000
3. Insights and market context are cached in `data\cache\`, so the demo does not wait on the models. Upload and "Ask NorthStar" run live (2 to 15 s).

## 3-minute story
**1. Hook (20 s).** "Nortech Systems is a mid-sized US electronics manufacturer: about $120m revenue, one bank, no private equity owner. In under two years its covenants were amended four times. It breached anyway, twice. It never missed a payment."
- Amendments: Mar 2025 (waived Q4 2024 and Q1 2025 breaches, $5k fee), May 2025 ($10k fee, maturity cut to Jun 2026, +25 bp), Jul 2025 (maturity extension), Feb 2026 (waived Q4 2025 breaches of leverage, fixed charge cover and minimum EBITDA; 0.25% fee; revolver cut from $15m to $12m; rate to SOFR + 3.50%). Refinanced with a new lender in Mar 2026. [Nortech 10-Q Q3 2025, 10-K 2025, 8-K 6 Mar 2026]

**2. Problem (25 s).** Loans to mid-sized companies carry covenants: promises tested every quarter. Big companies have treasury teams; PE-backed companies have their sponsor's finance team. A family-owned firm has a finance director and Excel. Two thirds of mid-market CFOs have no dedicated FP&A staff [Workday CFO survey]. One in three borrowers breached a covenant each year in the 2008-09 crisis [Chodorow-Reich and Falato].

**3. Demo: upload Nortech as it stood on 30 Sep 2024 (75 s).**
- Upload screen: type "Nortech Systems", electronics manufacturing, United States, Bank of America, US dollar, thousands. Drop `demo_files/nortech/credit_agreement_2024-03.htm` and `nortech_quarterly_accounts.xlsx`, click Analyse. Takes 10 to 20 s (up to about 45 s if Token Factory is returning 503s; the app retries and falls back to MiniMax). While it runs: "the open model is reading a 100-page credit agreement and our bookkeeper's line names; no numbers come from the model."
- Result panel: leverage below 2.50x, fixed charge cover above 1.25x, 11 of 11 account lines mapped. Click Review covenants, then Continue to dashboard.
- Latest accounts 30 Sep 2024. Leverage is 1.74x against a 2.50x limit: 30% headroom. Looks fine.
- If the upload fails twice: "No files to hand? Try a sample company" link at the bottom of the Upload screen loads the same company instantly.
- NorthStar forecasts a leverage breach in Q1 2025 (2.64x).
- Track record tab (backtest table): Nortech actually breached at the very next test (Q4 2024) and again in Q1 2025. With 30% headroom on paper, NorthStar was already warning of a breach within two quarters, from public numbers alone. (Say it this way: our forecast date was Q1 2025, the real first breach came one quarter sooner.)
- The covenants were read straight from the real credit agreement by an open model, with the clause quoted next to each number.

**4. Demo: a UK family firm (45 s).** Ashby & Rowe Engineering (fictional). Either upload `demo_files/ashby_rowe/` (£, thousands; 20 of 20 bookkeeper lines map) or, to save time, use the "UK engineering firm" sample link.
- Leverage 2.55x against 3.00x: fine. But the limit steps down to 2.50x in March 2027. NorthStar's stress test: customers can pay only 6 days later before a breach.
- Move the "customers pay later" slider to 10 days: breach in Q1 2027.
- Ask NorthStar: "We want to spend an extra £2m on R&D and machinery next year. Can we afford it?" Answer: £2m breaches leverage in Q1 2027 (2.57x); £1m passes (2.47x, thin headroom). The model ran the engine three times in about 1.5 s for a tenth of a cent. Every number comes from the engine, not the model.
- Messy books: both open models mapped 19 of 19 bookkeeper line names ("Dep'n plant & machinery", "Debtors control") correctly.

**5. Open vs closed (30 s).** 16 covenants in 9 real SEC credit documents, same prompt and excerpts for every model:
| Model | Accuracy | Cost per document |
|---|---|---|
| Claude Opus 5.5 (closed) | 100% | ~$0.0175 (estimate, a floor) |
| DeepSeek V4.1 Flash (open) | 100% | $0.0053 |
| MiniMax M3.1 Flash (open) | 100% | $0.0006 |
- Same accuracy, up to 28x cheaper. Where open fell short: on a messy redlined amendment, DeepSeek returned nothing twice; Claude gave the cleanest reading. So: open is good enough for clean documents; keep a human check on redlines.

**6. Why open, and close (20 s).** Loan terms and unaudited numbers are the most sensitive data a company has. Open weights can run inside the company's own environment (Token Factory dedicated endpoints, or self-hosted), and they are cheap enough for firms that will never buy Kyriba. Web searches only carry public metadata; the outbound log proves it. Channel: accountants and fractional finance directors who already look after many of these firms.

## Honest caveats (have answers ready)
- Our EBITDA is GAAP from SEC filings; banks add back items, so our ratios can be harsher than the bank's. The backtest flags the trend, not the bank's exact number. Example if asked: our minimum-EBITDA test says breach at Q3 2025 (filing: complied) and pass at Q4 2025 (10-K: waived default). Add-backs and a non-LTM measurement period in the amendments explain it; leverage is the covenant we call correctly.
- The what-if panel's sliders are customers-pay-later, EBITDA change, extra capex and rates. Revenue was removed from the UI because a one-quarter working-capital swing made it move breaches the "wrong" way on screen.
- Benchmark labels (`bench/labels.csv`) were drafted from the source text by the build agent, then checked against `bench/prompts/*.txt` by Claude (all 16 match; the mercer waiver and the ultraclean anticipated amendment are judgement calls) and rechecked on those two rows by a teammate. Say "checked against the source text", not "independently verified". Claude cost is estimated from characters; Claude ran inside Claude Code, so its speed is not comparable.
- The hosted demo sends analysis summaries to Nebius Token Factory. The privacy claim is "deployable privately", not "never leaves".
- Closed models can also be private (Claude on Bedrock offers zero data retention). Our case for open is cost and control, shown by the benchmark.

## Key verified market stats
- 10 to 20% of US public firms report a covenant violation in any given year (Nini, Smith and Sufi, 1996-2008).
- Fitch US private credit default rate: record 6.3% trailing 12 months to Aug 2026.
- Private credit AUM about $1.7tn (Preqin) to over $2tn (Moody's) in 2026.
- 34% of US and 40% of EMEA leveraged loans mature in 2028-29 (Fitch).
- SONIA about 3.77% (Tavily, BoE data, Jul-Oct 2026). Check BoE/Fed sites before quoting rates on a slide.
