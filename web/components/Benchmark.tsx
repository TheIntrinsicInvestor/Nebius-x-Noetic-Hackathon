"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getBenchmark } from "@/lib/api";
import { modelName, pct, seconds, usd } from "@/lib/format";
import type { BenchmarkResponse, BenchmarkRow } from "@/lib/types";
import { Card, ErrorNote, Spinner } from "./ui";

const accuracyKey = (r: BenchmarkRow) => `${r.kind_recall}|${r.threshold_acc}|${r.stepdown_acc}`;

/** "Same accuracy. Up to 28x cheaper." computed from the rows. */
function headline(rows: BenchmarkRow[]): string | null {
  const open = rows.filter((r) => r.open && r.cost_per_doc_usd > 0);
  const closed = rows.filter((r) => !r.open);
  if (!open.length || !closed.length) return null;
  const multiple = Math.max(...closed.map((r) => r.cost_per_doc_usd)) / Math.min(...open.map((r) => r.cost_per_doc_usd));
  if (!Number.isFinite(multiple) || multiple < 1.5) return null;
  const same = new Set(rows.map(accuracyKey)).size === 1;
  return `${same ? "Same accuracy. " : ""}Up to ${Math.round(multiple)}x cheaper.`;
}

export default function Benchmark() {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getBenchmark()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const rows = data
    ? [...data.rows].sort((a, b) => b.threshold_acc - a.threshold_acc || b.cost_per_doc_usd - a.cost_per_doc_usd)
    : [];
  const errorEntries = data ? Object.entries(data.errors ?? {}).filter(([, errs]) => errs.length > 0) : [];
  const notes = data?.notes ?? [];
  const title = headline(rows);

  return (
    <div className="space-y-5">
      <div>
        {title && <h2 className="font-serif text-[28px] font-semibold leading-tight text-accent">{title}</h2>}
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Same prompt, same excerpts, scored against labels drawn verbatim from the source text.
        </p>
      </div>
      <ErrorNote message={error} />
      <Card
        title="Open vs closed models on covenant extraction"
        aside={<button onClick={load} className="text-accent hover:underline">{loading ? <Spinner /> : "Refresh"}</button>}
      >
        {data && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Benchmark running. Results appear here when it finishes.</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-sm num">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium" />
                <th className="pb-2 text-right font-medium">Docs</th>
                <th className="pb-2 text-right font-medium">Covenants found</th>
                <th className="pb-2 text-right font-medium">Threshold correct</th>
                <th className="pb-2 text-right font-medium">Step-downs correct</th>
                <th className="pb-2 text-right font-medium">Made-up covenants</th>
                <th className="pb-2 text-right font-medium">Cost per document</th>
                <th className="pb-2 text-right font-medium">Speed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model} className="border-t border-line">
                  <td className="py-2 font-medium">{modelName(r.model)}</td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.open ? "bg-accent-soft text-accent" : "border border-line bg-canvas text-muted"}`}>
                      {r.open ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="py-2 text-right">{r.docs}</td>
                  <td className="py-2 text-right">{pct(r.kind_recall)}</td>
                  <td className="py-2 text-right">{pct(r.threshold_acc)}</td>
                  <td className="py-2 text-right">{pct(r.stepdown_acc)}</td>
                  <td className="py-2 text-right">{r.invented_covenants ?? "-"}</td>
                  <td className="py-2 text-right font-semibold">{usd(r.cost_per_doc_usd)}</td>
                  <td className="py-2 text-right">{r.latency_s == null ? <span className="text-muted">n/a (run in Claude Code)</span> : seconds(r.latency_s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {notes.length > 0 && (
        <Card title="What we found">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </Card>
      )}
      {errorEntries.length > 0 && (
        <Card title="Where open models fell short">
          <div className="space-y-4">
            {errorEntries.map(([model, errs]) => (
              <div key={model}>
                <h3 className="text-sm font-semibold">{modelName(model)}</h3>
                <table className="mt-1 w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-medium">Document</th>
                      <th className="py-1 font-medium">Field</th>
                      <th className="py-1 font-medium">Expected</th>
                      <th className="py-1 font-medium">Got</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errs.map((e, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="py-1 pr-3">{e.doc}</td>
                        <td className="py-1 pr-3">{e.field}</td>
                        <td className="py-1 pr-3 num">{e.expected}</td>
                        <td className="py-1 num text-breach">{e.got}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
