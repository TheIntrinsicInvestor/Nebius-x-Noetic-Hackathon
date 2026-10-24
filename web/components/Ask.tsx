"use client";

import { useState } from "react";
import { ask, errorMessage } from "@/lib/api";
import { seconds, usd } from "@/lib/format";
import type { AskResponse, ToolCall } from "@/lib/types";
import { Card, ErrorNote, Spinner } from "./ui";

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

export default function Ask({ caseName, currency }: { caseName: string; currency: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = [
    `We want to spend an extra ${currency}2m on R&D and machinery next year. Can we afford it?`,
    "Customers are paying us 10 days later. What happens to our covenants?",
    "What if interest rates rise by 1%?",
  ];

  async function submit(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion(text);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await ask(caseName, text));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const checked = result
    ? `Checked against the engine: ${describeCalls(result.tool_calls, currency) || "no engine runs"} in ${seconds(result.latency_s)} for ${usd(result.cost_usd)}`
    : "";

  return (
    <Card title="Ask Headroom" aside="An open model answers, the covenant engine does the maths">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(question); }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a what-if question about this company's covenants"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-line bg-canvas px-3 py-1 text-xs text-ink hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {loading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Spinner /> Running scenarios through the engine...</p>
      )}
      {result && (
        <div className="mt-3 rounded-md border border-line border-l-4 border-l-accent p-3">
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
      )}
    </Card>
  );
}
