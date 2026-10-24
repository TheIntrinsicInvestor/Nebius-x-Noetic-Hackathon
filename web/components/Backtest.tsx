"use client";

import { Fragment, useEffect, useState } from "react";
import { errorMessage, getBacktest } from "@/lib/api";
import { kindShort, quarterLabel, ratio } from "@/lib/format";
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
    <Card title="Backtest: would Headroom have seen it coming?" aside="Each row uses only the filings available at that date">
      <ErrorNote message={error} />
      {!rows && !error && <p className="text-sm text-muted"><Spinner /> Replaying past quarters...</p>}
      {rows && (
        <table className="w-full text-sm num">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">As of</th>
              <th className="pb-2 font-medium">Leverage vs limit</th>
              <th className="pb-2 font-medium">Headroom predicted first breach</th>
              <th className="pb-2 font-medium">What actually happened</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lev = r.current.find((p) => p.kind === "leverage");
              const hi = r.as_of.slice(0, 10) === HIGHLIGHT;
              const pb = r.predicted_first_breach;
              const isOpen = open === r.as_of;
              return (
                <Fragment key={r.as_of}>
                  <tr
                    className={`border-t border-line ${hi ? "bg-accent-soft" : ""} ${r.quote ? "cursor-pointer hover:bg-canvas" : ""}`}
                    onClick={() => r.quote && setOpen(isOpen ? null : r.as_of)}
                    title={r.quote ?? undefined}
                  >
                    <td className={`py-2 pl-2 ${hi ? "border-l-4 border-l-accent font-semibold" : "border-l-4 border-l-transparent"}`}>
                      {quarterLabel(r.as_of)}
                    </td>
                    <td className="py-2">
                      {lev ? (
                        <span>
                          {ratio(lev.value)} <span className="text-muted">vs {ratio(lev.threshold)}</span>
                          {lev.breached && <span className="ml-1 font-semibold text-breach">(breach)</span>}
                        </span>
                      ) : "-"}
                    </td>
                    <td className={`py-2 ${pb ? "font-semibold text-breach" : "text-muted"}`}>
                      {pb ? `${quarterLabel(pb.period_end)} (${kindShort(pb.kind)})` : "No breach in next 6 quarters"}
                    </td>
                    <td className="py-2">
                      <Outcome v={r.actual_in_compliance} />
                    </td>
                    <td className="py-2 pr-2 text-right text-xs text-accent">{r.quote ? (isOpen ? "Hide filing" : "Filing quote") : ""}</td>
                  </tr>
                  {hi && (
                    <tr className="bg-accent-soft">
                      <td colSpan={5} className="border-l-4 border-l-accent px-2 pb-2 text-xs text-accent">
                        Leverage looked comfortable here, yet Headroom&apos;s forecast already showed the breach coming.
                      </td>
                    </tr>
                  )}
                  {isOpen && r.quote && (
                    <tr>
                      <td colSpan={5} className="px-2 pb-3 text-xs italic text-muted">
                        <span className="not-italic font-semibold uppercase tracking-wider text-faint text-[10px] mr-2">From the 10-Q/10-K</span>
                        &ldquo;{r.quote}&rdquo;
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Outcome({ v }: { v: boolean | null }) {
  if (v === true) return <span className="text-ok font-medium">Complied</span>;
  if (v === false) return <span className="text-breach font-semibold">Breached (waived by bank)</span>;
  return <span className="text-muted">-</span>;
}
