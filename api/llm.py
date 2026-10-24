import json
import os
import time
from dataclasses import dataclass

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

BASE_URL = "https://api.tokenfactory.nebius.com/v1/"
PRIMARY_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash-1017"
SECOND_MODEL = "MiniMaxAI/MiniMax-M3.1-Flash"

# USD per 1M tokens (input, output), from the Token Factory console
PRICES: dict[str, tuple[float, float]] = {
    "deepseek-ai/DeepSeek-V4.1-Flash-1017": (0.30, 1.20),
    "MiniMaxAI/MiniMax-M3.1-Flash": (0.15, 0.60),
}


@dataclass
class CallStats:
    model: str
    prompt_tokens: int
    completion_tokens: int
    latency_s: float
    cost_usd: float


def _client() -> OpenAI:
    return OpenAI(base_url=BASE_URL, api_key=os.environ["NEBIUS_API_KEY"], max_retries=4)


def list_models() -> list[str]:
    return sorted(m.id for m in _client().models.list().data)


def chat_json(model: str, system: str, user: str, schema: dict, name: str) -> tuple[dict, CallStats]:
    client = _client()
    system = f"{system}\n\nRespond only with JSON matching this schema:\n{json.dumps(schema)}"
    last_err: Exception | None = None
    for _ in range(2):  # one retry on bad JSON
        t0 = time.perf_counter()
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_schema",
                             "json_schema": {"name": name, "schema": schema, "strict": True}},
            temperature=0,
        )
        latency = time.perf_counter() - t0
        try:
            data = json.loads(resp.choices[0].message.content)
        except (json.JSONDecodeError, TypeError) as e:
            last_err = e
            continue
        usage = resp.usage
        pin, pout = PRICES.get(model, (0.0, 0.0))
        cost = (usage.prompt_tokens * pin + usage.completion_tokens * pout) / 1e6
        return data, CallStats(model, usage.prompt_tokens, usage.completion_tokens, latency, cost)
    raise ValueError(f"{model} returned invalid JSON twice: {last_err}")
