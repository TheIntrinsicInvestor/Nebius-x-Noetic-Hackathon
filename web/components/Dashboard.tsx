"use client";

import { covValue, dateLabel, kindShort, money, pct, quarterLabel, isZeroScenario } from "@/lib/format";
import type { Analysis, CaseData, CovenantSet, Insight, Scenario } from "@/lib/types";
import Ask from "./Ask";
import HeadroomChart, { ChartLegend } from "./HeadroomChart";
import Insights from "./Insights";
import Market from "./Market";
import WhatIf from "./WhatIf";
import { Card, ErrorNote, Spinner } from "./ui";

export interface DashboardProps {
  caseData: CaseData;
  covenants: CovenantSet;
  base: Analysis | null;
  live: Analysis | null;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  busy: boolean;
  error: string | null;
  insights: Insight[] | null;
  insightsLoading: boolean;
  insightsError: string | null;
  onRefreshInsights: () => void;
}

export default function Dashboard(p: DashboardProps) {
  const { caseData, covenants, live } = p;
  const cur = caseData.meta.currency;

  if (!live) {
    return (
      <div className="space-y-3">
        <ErrorNote message={p.error} />
        {!p.error && <p className="text-sm text-muted"><Spinner /> Running the covenant engine...</p>}
      </div>
    );
  }

  const kinds = covenants.covenants.filter((c) => live.points.some((pt) => pt.kind === c.kind));

  return (
    <div className="space-y-5">
      <ErrorNote message={p.error} />
      <Banner caseData={caseData} a={live} scenarioOn={!isZeroScenario(p.scenario)} />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[17px] font-semibold">Covenant tests, actual and next {live.forecast.length || 6} quarters</h2>
          <ChartLegend />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 content-start">
          {kinds.map((c) => (
            <HeadroomChart
              key={c.kind}
              kind={c.kind}
              comparator={c.comparator}
              points={live.points.filter((pt) => pt.kind === c.kind)}
              currency={cur}
            />
          ))}
          {live.needs_input.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
              Not charted until you enter a threshold on the Review step: {live.needs_input.map(kindShort).join(", ")}.
            </div>
          )}
        </div>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <WhatIf scenario={p.scenario} onChange={p.onScenario} base={p.base} live={live} busy={p.busy} currency={cur} />
          <Refi a={live} currency={cur} />
          <Market caseName={caseData.meta.name} rewound={!!caseData.meta.as_of} />
        </div>
      </div>
      <Insights insights={p.insights} loading={p.insightsLoading} error={p.insightsError} onRefresh={p.onRefreshInsights} />
      <Ask key={caseData.meta.name} caseName={caseData.meta.name} currency={cur} covenants={covenants} />
    </div>
  );
}

function Banner({ caseData, a, scenarioOn }: {
  caseData: CaseData;
  a: Analysis;
  scenarioOn: boolean;
}) {
  const cur = caseData.meta.currency;
  const fb = a.first_breach;
  const horizon = a.forecast.length || 6;
  const lastQ = caseData.quarters[caseData.quarters.length - 1]?.period_end;
  const today = caseData.meta.as_of ?? lastQ;
  // latest actual reading of the covenant that breaks first
  const now = fb
    ? a.points.filter((pt) => pt.kind === fb.kind && !pt.is_forecast).sort((x, y) => y.period_end.localeCompare(x.period_end))[0]
    : undefined;
  const rs = a.reverse_stress;
  const noCushion = rs.ebitda_fall_pct === 0 && rs.dso_days === 0;
  const fall = -rs.ebitda_fall_pct;

  return (
    <section className={`rounded-lg border px-5 py-4 ${fb ? "border-breach/30 bg-breach-soft" : "border-ok/30 bg-ok-soft"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-medium text-ink">
              {caseData.meta.as_of ? `Today: ${dateLabel(today)} (rewound)` : `Latest accounts: ${dateLabel(today)}`}
            </span>
            {scenarioOn && <span className="rounded bg-surface px-1.5 py-0.5 font-medium text-accent">What-if scenario applied</span>}
            <span className="rounded bg-surface px-1.5 py-0.5">
              {a.budget_until ? `Forecast: your budget to ${quarterLabel(a.budget_until)}, trend after` : "Forecast: trend from your last 4 quarters"}
            </span>
          </div>
          <h2 className={`mt-1 font-serif text-[28px] font-semibold leading-tight ${fb ? "text-breach" : "text-ok"}`}>
            {fb ? `Projected breach: ${kindShort(fb.kind)} in ${quarterLabel(fb.period_end)}` : `No breach projected in the next ${horizon} quarters`}
          </h2>
          {fb && (
            <p className="mt-1 max-w-3xl text-sm text-ink num">
              {now && !now.breached ? (
                <>
                  Today {kindShort(fb.kind).toLowerCase()} is {covValue(fb.kind, now.value, cur)} against a {covValue(fb.kind, now.threshold, cur)} limit
                  ({pct(now.headroom_pct)} headroom), so it looks fine. The forecast crosses the limit in {quarterLabel(fb.period_end)} at{" "}
                  {covValue(fb.kind, fb.value, cur)}.
                </>
              ) : (
                <>Forecast {kindShort(fb.kind).toLowerCase()} reaches {covValue(fb.kind, fb.value, cur)} against a {covValue(fb.kind, fb.threshold, cur)} limit.</>
              )}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-6 text-sm num">
          <Stat label="Tightest covenant" value={kindShort(a.binding_kind)} />
          {noCushion ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted">Cushion before breach</dt>
              <dd className="mt-0.5 font-semibold text-breach">Already at or past the limit</dd>
            </div>
          ) : (
            <>
              <Stat label="EBITDA can fall" value={fall >= 0.895 ? "90%+" : pct(fall)} sub="before a breach" />
              <Stat label="Customers can pay" value={rs.dso_days >= 180 ? "180+ days" : `${Math.round(rs.dso_days)} days`} sub="slower before a breach" />
            </>
          )}
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold leading-tight">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

function Refi({ a, currency }: { a: Analysis; currency: string }) {
  const r = a.refi;
  return (
    <Card title="Refinancing">
      <dl className="space-y-2 text-sm num">
        <div className="flex justify-between">
          <dt className="text-muted">Months to maturity</dt>
          <dd className="font-semibold">{r.months_to_maturity ?? "-"}{r.maturity ? <span className="font-normal text-muted"> ({dateLabel(r.maturity)})</span> : null}</dd>
        </div>
        {r.talks_overdue ? (
          <div className="rounded-md bg-warn-soft px-2 py-1.5 font-semibold text-warn">Lender talks overdue</div>
        ) : r.start_talks_by ? (
          <div className="flex justify-between">
            <dt className="text-muted">Start lender talks by</dt>
            <dd className="font-semibold">{dateLabel(r.start_talks_by)}</dd>
          </div>
        ) : (
          <p className="text-muted">Maturity date not found in the agreement.</p>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Estimated cost of a breach</dt>
          <dd className="font-semibold">{money(r.est_breach_cost, currency)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-faint">Assumption: {r.breach_cost_assumption}</p>
    </Card>
  );
}
