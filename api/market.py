"""Public market context via Tavily. Privacy guard: queries are built only from public case metadata
(sector, country, lender, base rate), never from the company's financials or loan terms."""
import os
from datetime import date

from dotenv import load_dotenv

load_dotenv()


def market_queries(meta: dict) -> list[str]:
    year = date.today().year
    return [
        f"{meta['base_rate']} interest rate outlook {year}",
        f"{meta['country']} {meta['sector']} bank lending conditions and refinancing {year}",
        f"{meta['lender']} corporate lending news {year}",
    ]


def market_context(meta: dict, log) -> list[dict]:
    """Runs each query through Tavily search; `log(service, query)` records every outbound call."""
    from tavily import TavilyClient
    client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    out = []
    for q in market_queries(meta):
        log("Tavily search", q)
        r = client.search(q, max_results=3, include_answer=True)
        out.append({"query": q, "answer": r.get("answer"),
                    "sources": [{"title": s.get("title"), "url": s.get("url")} for s in r.get("results", [])]})
    return out
