# NorthStar

Covenant early warning for mid-sized companies ($10m to $500m of revenue).

Built in one day at the Noetic x Nebius hackathon (Imperial College London, 24 October 2026) by Brian Liew and Matthan Coelho.

**Live demo:** https://northstar-lovat-eight.vercel.app. To jump straight to a worked example, open [Hartley & Finch Packaging](https://northstar-lovat-eight.vercel.app/app?case=u-hartley-finch-packaging), a made-up UK firm that looks fine today but breaches its leverage covenant next quarter. The API sleeps when idle, so the first request after a quiet spell can fail once; try again.

## The problem

Most business loans come with covenants: ratios the company promises to stay within, tested every quarter. Break one and the bank can reprice the loan, charge a waiver fee or call it in.

Large corporates have treasury teams and expensive systems watching these numbers. Mid-sized firms, with $10m to $500m of revenue, carry the same complex debt but have small finance teams and no budget for those systems. They usually learn of a breach after the quarter closes, when it is too late to fix.

## What NorthStar does

You upload three things:

1. The loan agreement (`.pdf`, `.htm` or `.txt`)
2. Management accounts (Excel or PDF), with account names down the side and months or quarters across
3. Optionally, a budget in the same layout

PDF tables are read deterministically, never by the model. Scanned PDFs with no text layer are refused.

NorthStar then:

- reads the covenants out of the agreement and quotes the clause each one came from
- maps your account lines (whatever your bookkeeper called them) to revenue, costs, debt and so on
- projects the next six quarters and shows how close each covenant gets to its limit
- tells you how far EBITDA could fall, or how much later customers could pay, before you breach
- lets you test scenarios with sliders: customers paying faster or slower, EBITDA up or down, capex cuts or extra spend, interest rate moves
- answers plain-English questions ("Can we afford an extra £2m of capex next year?") by running those scenarios through the engine

## How it works

The rule we built around: **the language model never produces a number you see on screen.**

- An open-weight model (DeepSeek V4.1 Flash or MiniMax M3.1 Flash, hosted on Nebius Token Factory) does the reading. It finds the covenant section, extracts the terms as structured JSON and maps account names to categories.
- A deterministic Python engine does the maths: covenant tests, the forecast, headroom, reverse stress tests and refinancing timing.
- Any model-written text that quotes a number not found in the engine's output is dropped (insight cards) or flagged as unverified (chat answers).
- Only short excerpts of the agreement go to the model, not the whole document. Web searches for market context carry public details only (sector, country, lender, base rate), and every outbound call is logged in the app.

## Does it work on real companies?

We replayed **Nortech Systems** (US electronics manufacturer, about $120m revenue, one bank, no PE owner) quarter by quarter from its SEC filings.

At 30 September 2024, leverage was 1.74x against a 2.50x limit: 30% headroom, which looks fine. NorthStar's forecast already showed a breach in Q1 2025. In reality Nortech breached at the very next test (Q4 2024) and again in Q1 2025, and needed four covenant amendments in under two years. The landing page walks through the replay alongside quotes from the filings.

## Open vs closed models

Same prompt and same excerpts for every model: 16 covenants across 9 real SEC credit documents.

| Model | Covenants right | Cost per document |
|---|---|---|
| Claude Opus 5.5 (closed) | 16 / 16 | about $0.0175 (estimate) |
| DeepSeek V4.1 Flash (open) | 16 / 16 | $0.0053 |
| MiniMax M3.1 Flash (open) | 16 / 16 | $0.0006 |

Same accuracy, up to 28x cheaper. Where open models fell short: on a messy redlined amendment, DeepSeek returned an empty answer twice, and Claude gave the cleanest reading. Our takeaway is that open models are good enough for clean agreements, but redlined drafts still need a human check.

Details and raw outputs are in `bench/`.

## Running it locally

You need Python 3.11+, Node 20+ and a Nebius Token Factory API key.

```bash
# API
python -m venv .venv
.venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip
cp .env.example .env                           # then fill in your keys
.venv/bin/python -m uvicorn api.main:app --port 8000

# Web app (in a second terminal)
cd web
npm install
npm run dev
```

Open http://localhost:3000 for the landing page and http://localhost:3000/app for the app.

`.env` needs:

- `NEBIUS_API_KEY`: Token Factory key
- `TAVILY_API_KEY`: for the market context panel
- `SEC_USER_AGENT`: a name and contact email, which the SEC requires for its data API

If `~/.secrets/headroom.env` exists it is used instead of `.env`, for keeping keys out of a synced folder.

Tests: `python -m pytest -q` from the repo root, and `npx tsc --noEmit` in `web/`.

## Hosting

The live demo runs the API on Railway and the web app on Vercel.

- **API (Railway).** `railpack.json` holds the start command. Mount a volume and set `HEADROOM_STATE` to its path: uploads and caches are written there instead of `data/`, and on first start `seed/` copies in the Hartley & Finch example and its market cache. Set `NEBIUS_API_KEY`, `TAVILY_API_KEY` and `CORS_ORIGINS` (the web app's URL). `RATE_LIMIT_HOURLY` and `RATE_LIMIT_DAILY` cap the calls that cost money (uploads, questions, uncached market searches) per visitor per hour and in total per day; leave them unset to switch limits off, as in local runs.
- **Web (Vercel).** Deploy `web/` with `NEXT_PUBLIC_API` set to the API's URL. `/app?case=<name>` opens a company directly.

## Try it with real files

`demo_files/` has ready-made upload packs:

| Folder | Company | What's in it |
|---|---|---|
| `nortech/` | Nortech Systems (real) | 2024 credit agreement, quarterly accounts to Sep 2024 |
| `transcat/` | Transcat (real) | 2021 M&T Bank credit agreement, quarterly accounts to Jun 2026 |
| `eastern/` | The Eastern Company (real) | 2023 credit agreement, quarterly accounts to Jun 2025 |
| `ashby_rowe/` | Ashby & Rowe Engineering (made up) | UK facility agreement, monthly bookkeeper accounts, a budget |

The real companies' figures come from their SEC XBRL filings; amounts are in thousands of dollars. If you'd rather not pick files, the Upload screen's "Autofill with sample data" button fills in the Ashby & Rowe pack for you.

## Limitations

- **EBITDA is reported (GAAP) EBITDA.** Banks allow add-backs that public filings don't show, so our ratios can look worse than the bank's own calculation. NorthStar flags the trend, not the bank's exact number.
- **One facility per company.** A company with several loans on different terms gets one combined view.
- **The chat has no memory.** Each question is answered on its own.
- **Some agreements may have been amended since filing.** The Transcat pack uses its 2021 agreement.
- **"Deployable privately", not "never leaves your machine".** The hosted demo sends excerpts and account names to Token Factory. Open weights mean a company could run the same models inside its own environment.
- **The live demo is shared and rate-limited.** Anything uploaded there can be opened by anyone who knows the company name, and uploading a company with the same name replaces it. Don't upload real accounts.

## Repo layout

```
api/            FastAPI backend
  engine/       covenant maths: tests, forecast, headroom, refinancing
  locate.py     finds the covenant section in an agreement (US and UK/LMA wording)
  extract_agreement.py, upload.py, copilot.py, market.py, edgar.py
web/            Next.js front end
bench/          open vs closed benchmark
demo_files/     upload packs (see above)
data/           built-in cases and source filings
seed/           example case copied into a hosted deployment's empty volume
scripts/        builders for the sample data and demo packs
tests/          pytest suite
docs/           design spec, build plan, demo script
```
