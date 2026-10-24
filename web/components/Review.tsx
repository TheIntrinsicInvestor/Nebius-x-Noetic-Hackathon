"use client";

import { useState } from "react";
import { comparatorLabel, covValue, dateLabel, isMoneyKind, kindLabel, money } from "@/lib/format";
import type { CovenantSet } from "@/lib/types";
import { Card, Quote } from "./ui";

export default function Review({ covenants, currency, needsInput, edited, onThreshold, onReset, onContinue }: {
  covenants: CovenantSet;
  currency: string;
  needsInput: string[];
  edited: boolean;
  onThreshold: (index: number, value: number | null) => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const [resets, setResets] = useState(0);
  const f = covenants.facility;
  const missing = covenants.covenants.filter((c) => c.threshold == null).map((c) => c.kind);
  const warnings = Array.from(new Set([...needsInput, ...missing]));
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 xl:col-span-9 space-y-4">
        {warnings.length > 0 && (
          <div className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
            Needs your input: {warnings.map(kindLabel).join(", ")}. The threshold was not found in the agreement, so this
            covenant is skipped until you enter one.
          </div>
        )}
        <Card
          title="Covenants extracted from the agreement"
          aside={edited ? (
            <button onClick={() => { setResets((r) => r + 1); onReset(); }} className="text-accent hover:underline">Edited: reset to agreement</button>
          ) : "Edit a threshold to test it"}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium w-[34%]">Covenant</th>
                <th className="pb-2 font-medium">Rule</th>
                <th className="pb-2 font-medium">Threshold</th>
                <th className="pb-2 font-medium">Step-downs</th>
              </tr>
            </thead>
            <tbody>
              {covenants.covenants.map((c, i) => (
                <tr key={`${c.kind}-${i}`} className={`border-t border-line align-top ${c.threshold == null ? "bg-warn-soft/50" : ""}`}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{kindLabel(c.kind)}</div>
                    <div className="text-xs text-muted">
                      Tested {c.test_frequency}, trailing {c.measurement_quarters} quarters
                      {c.effective_from ? `, from ${dateLabel(c.effective_from)}` : ""}
                      {c.kind === "leverage" ? (c.nets_cash ? ", net of cash" : ", gross debt") : ""}
                    </div>
                    <Quote text={c.source_quote} />
                  </td>
                  <td className="py-3 pr-4 text-muted whitespace-nowrap">{comparatorLabel(c.comparator)}</td>
                  <td className="py-3 pr-4">
                    <ThresholdInput
                      key={`${c.kind}-${i}-${resets}`}
                      value={c.threshold}
                      prefix={isMoneyKind(c.kind) ? currency : ""}
                      suffix={isMoneyKind(c.kind) ? "m" : "x"}
                      onCommit={(v) => onThreshold(i, v)}
                    />
                  </td>
                  <td className="py-3 text-xs text-muted num">
                    {c.step_downs.length === 0 ? "None" : (
                      <ul className="space-y-0.5">
                        {c.step_downs.map((s) => (
                          <li key={s.date}>From {dateLabel(s.date)}: {covValue(c.kind, s.threshold, currency)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="col-span-12 xl:col-span-3 space-y-4">
        <Card title="Facility">
          <dl className="space-y-2 text-sm num">
            <Row label="Size" value={money(f.size, currency)} />
            <Row label="Maturity" value={dateLabel(f.maturity)} />
            <Row label="Margin" value={f.margin_pct == null ? "-" : `${f.margin_pct.toFixed(2)}% over ${f.base_rate_name ?? "base rate"}`} />
          </dl>
          <Quote text={f.source_quote} />
        </Card>
        <button
          onClick={onContinue}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function ThresholdInput({ value, prefix, suffix, onCommit }: {
  value: number | null;
  prefix: string;
  suffix: string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <label className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 focus-within:border-accent">
      {prefix && <span className="text-muted">{prefix}</span>}
      <input
        type="number"
        step="0.05"
        value={text}
        placeholder="enter"
        onChange={(e) => {
          setText(e.target.value);
          const v = e.target.value === "" ? null : parseFloat(e.target.value);
          if (v === null || Number.isFinite(v)) onCommit(v);
        }}
        className="w-16 bg-transparent text-right font-semibold num outline-none"
      />
      <span className="text-muted">{suffix}</span>
    </label>
  );
}
