"""python -m api.cli extract <file> | analyze --case nortech [--dso 10] | backtest"""
import argparse
from pathlib import Path

from api.cases import load_case
from api.engine.headroom import analyze
from api.extract_agreement import extract_covenants
from api.locate import html_to_text
from api.main import backtest_rows
from api.models import Scenario


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract")
    e.add_argument("file")
    a = sub.add_parser("analyze")
    a.add_argument("--case", default="nortech")
    a.add_argument("--dso", type=float, default=0)
    a.add_argument("--revenue", type=float, default=0)
    sub.add_parser("backtest")
    args = p.parse_args()

    if args.cmd == "extract":
        raw = Path(args.file).read_text(encoding="utf-8", errors="replace")
        text = html_to_text(raw) if args.file.endswith((".htm", ".html")) else raw
        cs, stats = extract_covenants(text)
        print(cs.model_dump_json(indent=1))
        print(stats)
    elif args.cmd == "analyze":
        qs, cs, meta = load_case(args.case)
        res = analyze(qs, cs, Scenario(dso_delta=args.dso, revenue_pct=args.revenue))
        print(meta["display_name"])
        for pt in res.points[-24:]:
            flag = "BREACH" if pt.breached else ""
            kind = "forecast" if pt.is_forecast else "actual"
            print(f"{pt.period_end} {pt.kind:<20} {pt.value:8.2f} vs {pt.threshold:<6} "
                  f"headroom {pt.headroom_pct:+.0%} {kind} {flag}")
        print("first breach:", res.first_breach and (res.first_breach.kind, res.first_breach.period_end))
        print("reverse stress:", res.reverse_stress, "refi:", res.refi)
    else:
        for r in backtest_rows():
            lev = next((c for c in r["current"] if c.kind == "leverage"), None)
            fb = r["predicted_first_breach"]
            print(r["as_of"], f"leverage {lev.value:.2f}x vs {lev.threshold}" if lev else "",
                  "| predicted breach:", (fb.kind, str(fb.period_end)) if fb else "none",
                  "| actual:", {True: "complied", False: "BREACHED", None: "-"}[r["actual_in_compliance"]])


if __name__ == "__main__":
    main()
