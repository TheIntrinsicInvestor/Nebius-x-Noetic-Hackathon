"use client";

import { useEffect, useRef, useState } from "react";
import { ask, errorMessage } from "@/lib/api";
import { seconds, usd } from "@/lib/format";
import type { AskResponse, CovenantSet, ToolCall } from "@/lib/types";
import { ErrorNote, Spinner } from "./ui";

const signed = (v: number, s: string) => `${v > 0 ? "+" : ""}${s}`;

function describeArgs(args: Record<string, unknown>, cur: string): string {
  const parts: string[] = [];
  for (const [k, raw] of Object.entries(args)) {
    const v = Number(raw);
    if (!Number.isFinite(v)) { parts.push(`${k} ${String(raw)}`); continue; }
    if (v === 0) continue;
    if (k === "revenue_pct") parts.push(`revenue ${signed(v, `${Math.round(v * 100)}%`)}`);
    else if (k === "ebitda_pct") parts.push(`EBITDA ${signed(v, `${Math.round(v * 100)}%`)}`);
    else if (k === "dso_delta") parts.push(`customers pay ${signed(v, `${v}`)} days`);
    else if (k === "dio_delta") parts.push(`stock days ${signed(v, `${v}`)}`);
    else if (k === "capex_extra") parts.push(`capex ${v < 0 ? "-" : "+"}${cur}${Math.abs(v).toFixed(1)}m`);
    else if (k === "rate_bp") parts.push(`rates ${signed(v, `${v}bp`)}`);
    else parts.push(`${k} ${v}`);
  }
  return parts.length ? parts.join(", ") : "base";
}

function describeCalls(calls: ToolCall[], cur: string): string {
  const scenarios = calls.filter((c) => c.name === "run_scenario");
  const other = calls.filter((c) => c.name !== "run_scenario");
  const bits: string[] = [];
  if (scenarios.length) {
    bits.push(
      `ran ${scenarios.length} scenario${scenarios.length > 1 ? "s" : ""} (${scenarios.map((c) => describeArgs(c.args ?? {}, cur)).join("; ")})`,
    );
  }
  if (other.length) bits.push(`called ${other.map((c) => c.name.replace(/_/g, " ")).join(", ")}`);
  return bits.join(" and ");
}

type Turn = { q: string; result?: AskResponse; error?: string };

// Floating chat panel. Each question is sent on its own: the API keeps no conversation memory.
export default function Ask({ caseName, currency, covenants }: { caseName: string; currency: string; covenants: CovenantSet }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    `We want to spend an extra ${currency}2m on R&D and machinery next year. Can we afford it?`,
    "Customers are paying us 10 days later. What happens to our covenants?",
    "What if interest rates rise by 1%?",
  ];

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, loading]);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion("");
    setTurns((t) => [...t, { q: text }]);
    setLoading(true);
    let done: Partial<Turn>;
    try {
      done = { result: await ask(caseName, text, covenants) };
    } catch (e) {
      done = { error: errorMessage(e) };
    }
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, ...done } : turn)));
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Ask NorthStar"
        // phones: a pill in the bottom corner; from sm up: the vertical tab on the right edge
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-navy/30 transition sm:bottom-auto sm:right-0 sm:top-1/2 sm:-translate-y-1/2 sm:flex-col sm:rounded-none sm:rounded-l-xl sm:border-l-[3px] sm:border-teal sm:px-2 sm:py-4 sm:hover:pr-3 ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-sky text-navy">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2l2.4 7.6H22l-6.2 4.6 2.4 7.6L12 17.2l-6.2 4.6 2.4-7.6L2 9.6h7.6z" /></svg>
        </span>
        <span className="tracking-wide sm:rotate-180 sm:[writing-mode:vertical-rl]">Ask NorthStar</span>
      </button>

      <aside
        aria-label="Ask NorthStar"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="bg-navy px-5 py-4 text-paper">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold text-white">Ask NorthStar</h2>
              <p className="mt-0.5 text-xs text-paper/70">An open model answers, the covenant engine does the maths.</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-paper/70 hover:bg-white/10 hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4">
          {turns.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Ask a what-if question about this company&apos;s covenants. Try:</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={loading}
                  className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:border-teal hover:bg-teal-soft disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="ml-10 rounded-2xl rounded-br-sm bg-navy px-3.5 py-2 text-sm text-white">{t.q}</div>
              {t.error && <div className="mr-6"><ErrorNote message={t.error} /></div>}
              {t.result && <Answer result={t.result} currency={currency} />}
            </div>
          ))}
          {loading && (
            <p className="mr-6 flex items-center gap-2 rounded-2xl rounded-bl-sm bg-surface px-3.5 py-2 text-sm text-muted">
              <Spinner /> Running scenarios through the engine...
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(question); }} className="border-t border-line bg-surface p-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this company's covenants"
              className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-4 py-2 text-base outline-none focus:border-teal sm:text-sm"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Ask
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-faint">Each question is answered on its own; it does not remember earlier ones.</p>
        </form>
      </aside>
    </>
  );
}

function Answer({ result, currency }: { result: AskResponse; currency: string }) {
  const checked = `Checked against the engine: ${describeCalls(result.tool_calls, currency) || "no engine runs"} in ${seconds(result.latency_s)} for ${usd(result.cost_usd)}`;
  return (
    <div className="mr-6 rounded-2xl rounded-bl-sm border border-line border-l-4 border-l-teal bg-surface p-3">
      {result.unverified_numbers.length > 0 && (
        <span
          className="mb-2 inline-block rounded bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn"
          title={`Not found in engine output: ${result.unverified_numbers.join(", ")}`}
        >
          Some numbers could not be verified
        </span>
      )}
      <div className="space-y-2 text-sm leading-relaxed">
        {result.answer.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      <p className="mt-2 text-xs text-faint num">{checked}</p>
    </div>
  );
}
