"""Run covenant extraction on every bench doc with each open model; save the exact prompt for the Claude baseline."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from api.extract_agreement import build_prompt
from api.llm import PRIMARY_MODEL, SECOND_MODEL, chat_json
from api.locate import html_to_text, locate_sections
from api.models import CovenantSet

B = Path(__file__).resolve().parent
NORTECH = ["2024-03_credit_agreement", "2025-03_amendment", "2025-05_amendment"]


def prepare() -> dict[str, tuple[str, str]]:
    docs = B / "docs"
    for n in NORTECH:
        src = B.parent / "data" / "nortech" / "docs" / f"{n}.htm"
        (docs / f"nortech_{n}.txt").write_text(html_to_text(src.read_text(encoding="utf-8", errors="replace")),
                                               encoding="utf-8")
    prompts = {}
    (B / "prompts").mkdir(exist_ok=True)
    for f in sorted(docs.glob("*.txt")):
        system, user = build_prompt(locate_sections(f.read_text(encoding="utf-8")))
        prompts[f.stem] = (system, user)
        (B / "prompts" / f"{f.stem}.txt").write_text(f"{system}\n\n{user}", encoding="utf-8")
    return prompts


def run(model: str, doc: str, system: str, user: str) -> str:
    out_dir = B / "out" / model.split("/")[-1]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "_model.txt").write_text(json.dumps(model), encoding="utf-8")
    try:
        data, st = chat_json(model, system, user, CovenantSet.model_json_schema(), "covenant_set")
        data["_stats"] = st.__dict__
    except Exception as e:  # a failed doc scores as all-missing, and is reported
        data = {"covenants": [], "_stats": {"error": repr(e)[:300]}}
    (out_dir / f"{doc}.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    return f"{model.split('/')[-1]} {doc} {data['_stats'].get('latency_s', 'ERR')}"


def main() -> None:
    prompts = prepare()
    jobs = [(m, d, s, u) for m in (PRIMARY_MODEL, SECOND_MODEL) for d, (s, u) in prompts.items()]
    with ThreadPoolExecutor(max_workers=8) as ex:
        for line in ex.map(lambda j: run(*j), jobs):
            print(line)


if __name__ == "__main__":
    main()
