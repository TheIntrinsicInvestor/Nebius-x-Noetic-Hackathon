"""Hosted deployment: rate limits on the endpoints that spend money, and seeding a fresh state volume."""
from fastapi.testclient import TestClient

import api.main as m

client = TestClient(m.app)


def _ask(monkeypatch, tmp_path, hourly, daily):
    monkeypatch.setenv("RATE_LIMIT_HOURLY", str(hourly))
    monkeypatch.setenv("RATE_LIMIT_DAILY", str(daily))
    monkeypatch.setattr(m, "RATE_FILE", tmp_path / "ratelimit.json")
    monkeypatch.setattr(m, "ask", lambda *a, **k: {"answer": "ok"})
    monkeypatch.setattr(m, "log_outbound", lambda *a: None)
    return lambda ip: client.post("/ask", json={"case": "sample_uk", "question": "x"},
                                  headers={"X-Real-IP": ip}).status_code


def test_no_limit_unless_configured(monkeypatch, tmp_path):
    post = _ask(monkeypatch, tmp_path, 1, 1)
    monkeypatch.delenv("RATE_LIMIT_HOURLY")
    assert [post("1.1.1.1") for _ in range(3)] == [200, 200, 200]
    assert not (tmp_path / "ratelimit.json").exists()


def test_hourly_limit_is_per_visitor(monkeypatch, tmp_path):
    post = _ask(monkeypatch, tmp_path, 2, 100)
    assert [post("1.1.1.1") for _ in range(3)] == [200, 200, 429]
    assert post("2.2.2.2") == 200


def test_daily_limit_is_shared(monkeypatch, tmp_path):
    post = _ask(monkeypatch, tmp_path, 10, 2)
    assert [post("1.1.1.1"), post("2.2.2.2"), post("3.3.3.3")] == [200, 200, 429]


def test_limit_message_reaches_the_browser(monkeypatch, tmp_path):
    post = _ask(monkeypatch, tmp_path, 1, 100)
    post("1.1.1.1")
    r = client.post("/ask", json={"case": "sample_uk", "question": "x"}, headers={"X-Real-IP": "1.1.1.1"})
    assert r.status_code == 429 and "an hour" in r.json()["detail"]


def test_seed_fills_a_fresh_volume_without_overwriting(tmp_path):
    seed, state = tmp_path / "seed", tmp_path / "state"
    (seed / "uploads" / "u-x").mkdir(parents=True)
    (seed / "uploads" / "u-x" / "meta.json").write_text("seed", encoding="utf-8")
    (seed / "cache").mkdir()
    (seed / "cache" / "market_u-x.json").write_text("seed", encoding="utf-8")
    (state / "cache").mkdir(parents=True)
    (state / "cache" / "market_u-x.json").write_text("newer", encoding="utf-8")
    m.seed_state(seed, state)
    assert (state / "uploads" / "u-x" / "meta.json").read_text(encoding="utf-8") == "seed"
    assert (state / "cache" / "market_u-x.json").read_text(encoding="utf-8") == "newer"


def test_showcase_case_is_seeded():
    assert (m.ROOT / "seed" / "uploads" / "u-hartley-finch-packaging" / "meta.json").exists()
