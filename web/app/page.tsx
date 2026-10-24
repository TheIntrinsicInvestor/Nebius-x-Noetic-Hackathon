"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Backtest from "@/components/Backtest";
import Benchmark from "@/components/Benchmark";
import Dashboard from "@/components/Dashboard";
import Outbound from "@/components/Outbound";
import Review from "@/components/Review";
import Upload from "@/components/Upload";
import { analyze, errorMessage, getCase } from "@/lib/api";
import { isZeroScenario } from "@/lib/format";
import type { Analysis, CaseData, CaseName, CovenantSet, Insight, Scenario } from "@/lib/types";
import { ZERO_SCENARIO } from "@/lib/types";

type Tab = "upload" | "review" | "dashboard" | "track" | "benchmark";

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "review", label: "Review" },
  { id: "dashboard", label: "Dashboard" },
  { id: "track", label: "Track record" },
  { id: "benchmark", label: "Open vs Closed" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("upload");
  const [caseName, setCaseName] = useState<CaseName | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [covenants, setCovenants] = useState<CovenantSet | null>(null);
  // covenants differ from the case's own (edited or uploaded): send them to /analyze
  const [override, setOverride] = useState(false);
  const [loadingCase, setLoadingCase] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario>(ZERO_SCENARIO);
  const [base, setBase] = useState<Analysis | null>(null);
  const [live, setLive] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const baseReq = useRef(0);
  const liveReq = useRef(0);
  const insightReq = useRef(0);

  const runInsights = useCallback((name: CaseName, cs: CovenantSet | null) => {
    const id = ++insightReq.current;
    setInsightsLoading(true);
    setInsightsError(null);
    analyze({ case: name, covenants: cs, scenario: ZERO_SCENARIO, insights: true })
      .then((r) => { if (id === insightReq.current) setInsights(r.insights); })
      .catch((e) => { if (id === insightReq.current) setInsightsError(errorMessage(e)); })
      .finally(() => { if (id === insightReq.current) setInsightsLoading(false); });
  }, []);

  async function loadCase(name: CaseName, uploaded?: CovenantSet) {
    setLoadingCase(name);
    setCaseError(null);
    try {
      const d = await getCase(name);
      setCaseName(name);
      setCaseData(d);
      setCovenants(uploaded ?? d.covenants);
      setOverride(!!uploaded);
      setScenario(ZERO_SCENARIO);
      setBase(null);
      setLive(null);
      setInsights(null);
      setAnalysisError(null);
      runInsights(name, uploaded ?? null);
      setTab("review");
    } catch (e) {
      setCaseError(errorMessage(e));
    } finally {
      setLoadingCase(null);
    }
  }

  // Base case: re-run whenever the case or covenants change.
  useEffect(() => {
    if (!caseName || !covenants) return;
    const id = ++baseReq.current;
    const t = setTimeout(() => {
      analyze({ case: caseName, covenants: override ? covenants : null, scenario: ZERO_SCENARIO, insights: false })
        .then((r) => { if (id === baseReq.current) { setBase(r.analysis); setAnalysisError(null); } })
        .catch((e) => { if (id === baseReq.current) setAnalysisError(errorMessage(e)); });
    }, 250);
    return () => clearTimeout(t);
  }, [caseName, covenants, override]);

  // What-if: debounced 250ms, only when a slider is off zero.
  useEffect(() => {
    const id = ++liveReq.current;
    if (!caseName || !covenants || isZeroScenario(scenario)) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      analyze({ case: caseName, covenants: override ? covenants : null, scenario, insights: false })
        .then((r) => { if (id === liveReq.current) { setLive(r.analysis); setAnalysisError(null); } })
        .catch((e) => { if (id === liveReq.current) setAnalysisError(errorMessage(e)); })
        .finally(() => { if (id === liveReq.current) setBusy(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [caseName, covenants, override, scenario]);

  function setThreshold(i: number, v: number | null) {
    if (!covenants) return;
    const next: CovenantSet = {
      ...covenants,
      covenants: covenants.covenants.map((c, j) => (j === i ? { ...c, threshold: v } : c)),
    };
    setCovenants(next);
    setOverride(true);
  }

  function resetCovenants() {
    if (!caseData) return;
    setCovenants(caseData.covenants);
    setOverride(false);
  }

  const shown = isZeroScenario(scenario) ? base : live ?? base;
  const needsCase = (t: Tab) => (t === "review" || t === "dashboard") && !caseData;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tight text-accent">NorthStar</span>
            <span className="hidden text-sm text-muted md:inline">See the covenant breach before your bank does.</span>
          </div>
          {caseData && (
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-semibold">{caseData.meta.display_name}</div>
              <div className="truncate text-xs text-muted max-w-[560px]">{caseData.meta.description}</div>
              <div className="truncate text-[11px] text-faint max-w-[560px]">
                {[caseData.meta.sector, caseData.meta.country, caseData.meta.lender, caseData.meta.base_rate].filter(Boolean).join(" · ")}
              </div>
            </div>
          )}
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 px-6">
          {TABS.map((t, i) => {
            const disabled = needsCase(t.id);
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => !disabled && setTab(t.id)}
                disabled={disabled}
                title={disabled ? "Load a company first" : undefined}
                className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition ${
                  active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${active ? "bg-accent text-white" : "bg-canvas text-muted"}`}>
                  {i + 1}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
        {tab === "upload" && <Upload onLoad={loadCase} loading={loadingCase} error={caseError} />}
        {tab === "review" && covenants && caseData && (
          <Review
            covenants={covenants}
            currency={caseData.meta.currency}
            needsInput={base?.needs_input ?? []}
            edited={override}
            onThreshold={setThreshold}
            onReset={resetCovenants}
            onContinue={() => setTab("dashboard")}
          />
        )}
        {tab === "dashboard" && caseData && covenants && (
          <Dashboard
            caseData={caseData}
            covenants={covenants}
            base={base}
            live={shown}
            scenario={scenario}
            onScenario={setScenario}
            busy={busy}
            error={analysisError}
            insights={insights}
            insightsLoading={insightsLoading}
            insightsError={insightsError}
            onRefreshInsights={() => caseName && runInsights(caseName, override ? covenants : null)}
          />
        )}
        {tab === "track" && (
          <div className="space-y-4">
            <p className="max-w-3xl text-sm text-muted">
              Track record on a real company: Nortech Systems, a US electronics manufacturer with one bank and no private equity
              owner. We replayed its public filings quarter by quarter and compared NorthStar&apos;s forecast with what the
              company later reported to the SEC.
            </p>
            <Backtest />
          </div>
        )}
        {tab === "benchmark" && <Benchmark />}
      </main>

      <Outbound />
    </div>
  );
}
