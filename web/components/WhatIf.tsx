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
  fmt: (v: number) => string;
}

export default function WhatIf({ scenario, onChange, base, live, busy, currency }: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  base: Analysis | null;
  live: Analysis | null;
  busy: boolean;
  currency: string;
}) {
  const sliders: SliderDef[] = [
    { key: "dso_delta", label: "Customers pay later (days)", min: 0, max: 60, step: 1, scale: 1, fmt: (v) => `+${v} days` },
    { key: "revenue_pct", label: "Revenue change", min: -30, max: 10, step: 1, scale: 0.01, fmt: (v) => `${v > 0 ? "+" : ""}${v}%` },
    { key: "capex_extra", label: "Extra capex / R&D (over next 4 quarters)", min: 0, max: 5, step: 0.25, scale: 1, fmt: (v) => `${currency}${v.toFixed(2)}m` },
    { key: "rate_bp", label: "Interest rate change", min: 0, max: 300, step: 25, scale: 1, fmt: (v) => `+${v}bp` },
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
                <span className={`num ${v !== 0 ? "font-semibold text-accent" : "text-muted"}`}>{s.fmt(v)}</span>
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
    return <p className="mt-4 text-xs text-muted">Move a slider to stress the forecast. Charts and the banner update live.</p>;
  }
  const b = base.first_breach;
  const l = live.first_breach;
  let text: string;
  let bad = false;
  if (!b && !l) text = "Still no breach projected under this scenario.";
  else if (b && !l) text = `The ${quarterLabel(b.period_end)} breach is avoided under this scenario.`;
  else if (!b && l) { text = `Breach appears in ${quarterLabel(l.period_end)} (${kindShort(l.kind)}). None in the base case.`; bad = true; }
  else if (b!.period_end === l!.period_end) text = `Breach stays in ${quarterLabel(l!.period_end)}.`;
  else {
    text = `Breach moves from ${quarterLabel(b!.period_end)} to ${quarterLabel(l!.period_end)}.`;
    bad = l!.period_end < b!.period_end;
  }
  return (
    <div className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${bad ? "bg-breach-soft text-breach" : "bg-accent-soft text-accent"}`}>
      {text}
    </div>
  );
}
