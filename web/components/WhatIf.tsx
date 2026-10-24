"use client";

import { quarterLabel, kindShort, isZeroScenario } from "@/lib/format";
import type { Analysis, Scenario } from "@/lib/types";
import { ZERO_SCENARIO } from "@/lib/types";
import { Card, Spinner } from "./ui";

interface SliderDef {
  key: keyof Scenario;
  label: string;
  min: number;
  max: number;
  step: number;
  /** slider units -> scenario units */
  scale: number;
  /** direction that improves the business: 1 = higher is better, -1 = lower is better */
  better: 1 | -1;
  fmt: (v: number) => string;
}

const signed = (v: number, s: string) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${s}`;

export default function WhatIf({ scenario, onChange, base, live, busy, currency }: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  base: Analysis | null;
  live: Analysis | null;
  busy: boolean;
  currency: string;
}) {
  const sliders: SliderDef[] = [
    { key: "dso_delta", label: "Customers pay faster / slower (days)", min: -30, max: 60, step: 1, scale: 1, better: -1, fmt: (v) => signed(v, `${Math.abs(v)} days`) },
    { key: "ebitda_pct", label: "EBITDA change", min: -30, max: 20, step: 1, scale: 0.01, better: 1, fmt: (v) => signed(v, `${Math.abs(v)}%`) },
    { key: "capex_extra", label: "Capex / R&D cut or extra (over next 4 quarters)", min: -2, max: 5, step: 0.25, scale: 1, better: -1, fmt: (v) => signed(v, `${currency}${Math.abs(v).toFixed(2)}m`) },
    { key: "rate_bp", label: "Interest rate change", min: -150, max: 300, step: 25, scale: 1, better: -1, fmt: (v) => signed(v, `${Math.abs(v)}bp`) },
  ];
  const zero = isZeroScenario(scenario);

  return (
    <Card
      title={<span className="flex items-center gap-2">What if {busy && <Spinner />}</span>}
      aside={!zero && (
        <button onClick={() => onChange(ZERO_SCENARIO)} className="text-accent hover:underline">Reset</button>
      )}
    >
      <div className="space-y-4">
        {sliders.map((s) => {
          const v = Math.round((scenario[s.key] / s.scale) * 100) / 100;
          return (
            <label key={s.key} className="block">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-ink">{s.label}</span>
                <span className={`num ${v === 0 ? "text-muted" : v * s.better > 0 ? "font-semibold text-ok" : "font-semibold text-breach"}`}>{s.fmt(v)}</span>
              </div>
              <input
                type="range"
                aria-label={s.label}
                min={s.min}
                max={s.max}
                step={s.step}
                value={v}
                onChange={(e) => onChange({ ...scenario, [s.key]: parseFloat(e.target.value) * s.scale })}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[10px] text-faint">
                <span>{s.better === 1 ? "worse" : "better"}</span>
                <span>{s.better === 1 ? "better" : "worse"}</span>
              </div>
            </label>
          );
        })}
      </div>
      <Delta base={base} live={live} zero={zero} />
    </Card>
  );
}

function Delta({ base, live, zero }: { base: Analysis | null; live: Analysis | null; zero: boolean }) {
  if (zero || !base || !live) {
    return <p className="mt-4 text-xs text-muted">Move a slider to stress or improve the forecast. Charts and the banner update live.</p>;
  }
  const b = base.first_breach;
  const l = live.first_breach;
  let text: string;
  let tone: "bad" | "good" | "neutral" = "neutral";
  if (!b && !l) text = "Still no breach projected under this scenario.";
  else if (b && !l) { text = `The ${quarterLabel(b.period_end)} breach is avoided under this scenario.`; tone = "good"; }
  else if (!b && l) { text = `Breach appears in ${quarterLabel(l.period_end)} (${kindShort(l.kind)}). None in the base case.`; tone = "bad"; }
  else if (b!.period_end === l!.period_end) text = `Breach stays in ${quarterLabel(l!.period_end)}.`;
  else {
    text = `Breach moves from ${quarterLabel(b!.period_end)} to ${quarterLabel(l!.period_end)}.`;
    tone = l!.period_end < b!.period_end ? "bad" : "good";
  }
  const toneClass = { bad: "bg-breach-soft text-breach", good: "bg-ok-soft text-ok", neutral: "bg-accent-soft text-accent" }[tone];
  return (
    <div className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${toneClass}`}>
      {text}
    </div>
  );
}
