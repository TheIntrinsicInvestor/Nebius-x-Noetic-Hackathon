from bench.score import score_doc, thr_match


def test_threshold_match_tolerance():
    assert thr_match(4.25, 4.2501)
    assert not thr_match(4.25, 4.0)
    assert thr_match(1600000, 1600000.0)


def test_score_doc_counts_hits_and_hallucinations():
    labels = [{"kind": "leverage", "threshold": 2.5, "step_downs": ""},
              {"kind": "fixed_charge_cover", "threshold": 1.25, "step_downs": ""}]
    out = {"covenants": [
        {"kind": "leverage", "threshold": 2.5, "step_downs": []},
        {"kind": "interest_cover", "threshold": 3.0, "step_downs": []},
    ]}
    s = score_doc(labels, out)
    assert s["labelled"] == 2
    assert s["threshold_hits"] == 1
    assert s["extra"] == 1


def test_redundant_step_down_is_equivalent():
    labels = [{"kind": "leverage", "threshold": 3.5, "step_downs": "2026-06-30:4.75;2026-12-31:3.5"}]
    out = {"covenants": [{"kind": "leverage", "threshold": 3.5, "step_downs": [
        {"date": "2026-06-30", "threshold": 4.75}, {"date": "2026-09-30", "threshold": 4.75},
        {"date": "2026-12-31", "threshold": 3.5}]}]}
    assert score_doc(labels, out)["stepdown_hits"] == 1


def test_step_downs_must_match_exactly():
    labels = [{"kind": "leverage", "threshold": 3.5, "step_downs": "2025-12-31:2.5"}]
    good = {"covenants": [{"kind": "leverage", "threshold": 3.5,
                           "step_downs": [{"date": "2025-12-31", "threshold": 2.5}]}]}
    bad = {"covenants": [{"kind": "leverage", "threshold": 3.5, "step_downs": []}]}
    assert score_doc(labels, good)["stepdown_hits"] == 1
    assert score_doc(labels, bad)["stepdown_hits"] == 0
