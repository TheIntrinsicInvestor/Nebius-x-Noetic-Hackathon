"""Score each model's covenant extraction against hand labels. Writes bench/results.json."""
import csv
import json
from collections import defaultdict
from pathlib import Path

B = Path(__file__).resolve().parent
OPEN_MODELS = {"deepseek-ai/DeepSeek-V4.1-Flash-1017", "MiniMaxAI/MiniMax-M3.1-Flash"}
# Claude runs via Claude Code subagents: no API usage figures, so cost is estimated from characters/4 tokens
# at published API prices (USD per 1M input, output). Set in run_claude notes; see bench/README.
CLAUDE_PRICE = (4.0, 20.0)  # claude-opus-5-5 (Claude Code subagents run on it)


def thr_match(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= max(0.005, 0.001 * abs(a))


def _steps(s) -> set[tuple[str, float]]:
    if isinstance(s, str):
        raw = [(p.split(":")[0], round(float(p.split(":")[1]), 4)) for p in s.split(";") if p.strip()]
    else:
        raw = [(x["date"], round(float(x["threshold"]), 4)) for x in s or []]
    out, prev = set(), None
    for d, t in sorted(raw):  # a step that repeats the level already in force changes nothing
        if t != prev:
            out.add((d, t))
        prev = t
    return out


def score_doc(labels: list[dict], out: dict) -> dict:
    covs = out.get("covenants", [])
    used = set()
    s = {"labelled": len(labels), "kind_hits": 0, "threshold_hits": 0, "stepdown_hits": 0, "extra": 0,
         "errors": []}
    for lab in labels:
        same_kind = [i for i, c in enumerate(covs) if c["kind"] == lab["kind"]]
        if same_kind:
            s["kind_hits"] += 1
        match = next((i for i in same_kind if i not in used and thr_match(float(lab["threshold"]), covs[i]["threshold"])), None)
        if match is None:
            got = [covs[i]["threshold"] for i in same_kind]
            s["errors"].append({"field": f"{lab['kind']} threshold", "expected": str(lab["threshold"]), "got": str(got or "missing")})
            continue
        used.add(match)
        s["threshold_hits"] += 1
        if _steps(lab["step_downs"]) == _steps(covs[match].get("step_downs")):
            s["stepdown_hits"] += 1
        else:
            s["errors"].append({"field": f"{lab['kind']} step-downs", "expected": lab["step_downs"] or "none",
                                "got": ";".join(f"{d}:{t}" for d, t in sorted(_steps(covs[match].get("step_downs")))) or "none"})
    s["extra"] = len([i for i in range(len(covs)) if i not in used and covs[i].get("threshold") is not None
                      and not any(c["kind"] == covs[i]["kind"] for c in labels)])
    return s


def main() -> None:
    labels: dict[str, list[dict]] = defaultdict(list)
    with open(B / "labels.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            labels[row["doc"]].append(row)
    rows, errors = [], {}
    for mdir in sorted(p for p in (B / "out").iterdir() if p.is_dir()):
        tot = defaultdict(float)
        cost, lat, n, errs = 0.0, [], 0, []
        for doc, labs in labels.items():
            f = mdir / f"{doc}.json"
            if not f.exists():
                continue
            out = json.loads(f.read_text(encoding="utf-8-sig"))
            s = score_doc(labs, out)
            for k in ("labelled", "kind_hits", "threshold_hits", "stepdown_hits", "extra"):
                tot[k] += s[k]
            errs += [{"doc": doc, **e} for e in s.pop("errors")]
            st = out.get("_stats", {})
            if not st:  # Claude Code subagent output: estimate from the prompt and answer sizes
                st = {"prompt_chars": len((B / "prompts" / f"{doc}.txt").read_text(encoding="utf-8-sig")),
                      "completion_chars": len(f.read_text(encoding="utf-8-sig"))}
            if st.get("cost_usd") is not None:
                cost += st["cost_usd"]
            else:  # Claude estimate
                cost += (st.get("prompt_chars", 0) / 4 * CLAUDE_PRICE[0] + st.get("completion_chars", 0) / 4 * CLAUDE_PRICE[1]) / 1e6
            if st.get("latency_s") is not None:
                lat.append(st["latency_s"])
            n += 1
        if not n:
            continue
        model = json.loads((mdir / "_model.txt").read_text(encoding="utf-8-sig")) if (mdir / "_model.txt").exists() else mdir.name
        rows.append({"model": model, "open": model in OPEN_MODELS, "docs": n,
                     "kind_recall": tot["kind_hits"] / tot["labelled"],
                     "threshold_acc": tot["threshold_hits"] / tot["labelled"],
                     "stepdown_acc": tot["stepdown_hits"] / tot["labelled"],
                     "invented_covenants": int(tot["extra"]),
                     "cost_per_doc_usd": cost / n,
                     "latency_s": sum(lat) / len(lat) if lat else None})
        errors[model] = errs[:6]
    notes = json.loads((B / "notes.json").read_text(encoding="utf-8-sig")) if (B / "notes.json").exists() else []
    (B / "results.json").write_text(json.dumps({"rows": rows, "errors": errors, "notes": notes}, indent=1),
                                    encoding="utf-8")
    for r in rows:
        print(r)


if __name__ == "__main__":
    main()
