"use client";

import { Fragment, useEffect, useState } from "react";
import { errorMessage, getBacktest } from "@/lib/api";
import { isUndefinedRatio, kindShort, quarterLabel, ratio } from "@/lib/format";
import type { BacktestRow } from "@/lib/types";
import { Card, ErrorNote, Spinner } from "./ui";

const HIGHLIGHT = "2024-09-30";

export default function Backtest() {
  const [rows, setRows] = useState<BacktestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getBacktest().then(setRows).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <Card title="Backtest: would NorthStar have seen it coming?" aside="Each row forecasts from the quarters up to that date (latest filed figures)">
      <ErrorNote message={error} />
      {!rows && !error && <p className="text-sm text-muted"><Spinner /> Replaying past quarters...</p>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm num">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[19%]" />
              <col className="w-[29%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-line text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
                <th className="py-2 pl-3">Quarter</th>
                <th className="py-2 pr-4 text-right">Leverage</th>
                <th className="py-2 pr-4 text-right">Limit</th>
                <th className="py-2">Status</th>
                <th className="py-2">NorthStar predicted</th>
                <th className="py-2">What actually happened</th>
                <th className="py-2 pr-3 text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lev = r.current.find((p) => p.kind === "leverage");
                const hi = r.as_of.slice(0, 10) === HIGHLIGHT;
                const pb = r.predicted_first_breach;
                const isOpen = open === r.as_of;
                const edge = hi ? "border-l-4 border-l-teal" : "border-l-4 border-l-transparent";
                return (
                  <Fragment key={r.as_of}>
                    <tr className={`border-t border-line align-top ${hi ? "bg-teal-soft" : "hover:bg-canvas/60"}`}>
                      <td className={`py-3 pl-3 ${edge} ${hi ? "font-semibold" : ""}`}>{quarterLabel(r.as_of)}</td>
                      <td className="py-3 pr-4 text-right font-medium">{lev ? <Lev v={lev.value} /> : "-"}</td>
                      <td className="py-3 pr-4 text-right text-muted">{lev ? ratio(lev.threshold) : "-"}</td>
                      <td className="py-3">{lev && <Badge tone={lev.breached ? "breach" : "ok"}>{lev.breached ? "Breach" : "Within limit"}</Badge>}</td>
                      <td className="py-3">
                        {pb ? (
                          <span className="font-semibold text-breach">Breach in {quarterLabel(pb.period_end)}{pb.kind !== "leverage" && ` (${kindShort(pb.kind)})`}</span>
                        ) : (
                          <span className="text-muted">No breach in next 4 quarters</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Outcome v={r.actual_in_compliance} />
                        {r.note && <div className="mt-1 text-xs leading-snug text-muted">{r.note}</div>}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {r.quote && (
                          <button
                            onClick={() => setOpen(isOpen ? null : r.as_of)}
                            className="rounded border border-line px-2 py-0.5 text-xs font-medium text-teal hover:border-teal hover:bg-teal-soft"
                          >
                            {isOpen ? "Hide" : "Filing"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {hi && (
                      <tr className="bg-teal-soft">
                        <td colSpan={7} className={`${edge} pb-3 pl-3 text-xs font-medium text-ink`}>
                          Leverage looked comfortable here, yet NorthStar&apos;s forecast already showed the breach coming.
                        </td>
                      </tr>
                    )}
                    {isOpen && r.quote && (
                      <tr>
                        <td colSpan={7} className="pb-3 pl-3 pr-3">
                          <div className="rounded-md border-l-2 border-l-faint bg-canvas px-3 py-2 text-xs italic leading-relaxed text-muted">
                            <span className="mr-2 text-[10px] font-semibold not-italic uppercase tracking-wider text-faint">From the 10-Q/10-K</span>
                            &ldquo;{r.quote}&rdquo;
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Badge({ tone, children }: { tone: "breach" | "ok"; children: React.ReactNode }) {
  const cls = tone === "breach" ? "bg-breach-soft text-breach" : "bg-ok-soft text-ok";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

// Extreme or undefined ratios are noise in a table: cap the display, keep the exact value on hover.
function Lev({ v }: { v: number }) {
  if (isUndefinedRatio(v)) return <span title="Not meaningful: EBITDA at or below zero" className="cursor-help underline decoration-dotted underline-offset-2">n/m</span>;
  if (v > 10) return <span title={ratio(v)} className="cursor-help underline decoration-dotted underline-offset-2">&gt;10x</span>;
  return <>{ratio(v)}</>;
}

function Outcome({ v }: { v: boolean | null }) {
  if (v === true) return <Badge tone="ok">Complied</Badge>;
  if (v === false) return <Badge tone="breach">Breached, waived by bank</Badge>;
  return <span className="text-faint">-</span>;
}
