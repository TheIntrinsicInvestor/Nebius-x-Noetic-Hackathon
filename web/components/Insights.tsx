"use client";

import type { Insight } from "@/lib/types";
import { Card, ErrorNote } from "./ui";

export default function Insights({ insights, loading, error, onRefresh }: {
  insights: Insight[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <Card
      title="What this means"
      aside={
        <span className="flex items-center gap-3">
          <span>Written by an open model from the engine&apos;s numbers</span>
          {!loading && <button onClick={onRefresh} className="text-accent hover:underline">Refresh</button>}
        </span>
      }
    >
      <ErrorNote message={error} />
      {loading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-md border border-line p-3">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-11/12" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          ))}
        </div>
      )}
      {!loading && insights && insights.length === 0 && !error && (
        <p className="text-sm text-muted">No insights returned.</p>
      )}
      {!loading && insights && insights.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {insights.map((ins, i) => (
            <article key={i} className="rounded-md border border-line border-l-4 border-l-accent p-3">
              <h3 className="text-sm font-semibold">{ins.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{ins.body}</p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
