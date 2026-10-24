"use client";

import { useState } from "react";
import { errorMessage, getOutbound } from "@/lib/api";
import type { OutboundCall } from "@/lib/types";

export default function Outbound() {
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<OutboundCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      getOutbound().then((c) => { setCalls(c); setError(null); }).catch((e) => setError(errorMessage(e)));
    }
  }

  return (
    <footer className="mt-10 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-6 py-3">
        <button onClick={toggle} className="flex w-full items-center justify-between text-left text-xs text-muted">
          <span>
            <span className="font-semibold text-ink">Outbound data</span>
            <span className="ml-3">
              Company data goes only to the open model, which can run inside your own environment. Web searches carry
              public metadata only (sector, country, lender, base rate).
            </span>
          </span>
          <span className="ml-4 shrink-0 text-accent">{open ? "Hide log" : "Show log"}</span>
        </button>
        {open && (
          <div className="mt-3 max-h-56 overflow-auto">
            {error && <p className="text-xs text-breach">{error}</p>}
            {calls && calls.length === 0 && <p className="text-xs text-muted">No outbound calls yet this session.</p>}
            {calls && calls.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-medium">Time</th>
                    <th className="py-1 font-medium">Service</th>
                    <th className="py-1 font-medium">Query</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1 pr-4 whitespace-nowrap num">{c.time}</td>
                      <td className="py-1 pr-4 whitespace-nowrap">{c.service}</td>
                      <td className="py-1 font-mono text-[11px] text-muted">{c.query}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
