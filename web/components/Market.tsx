"use client";

import { useEffect, useState } from "react";
import { errorMessage, getMarket } from "@/lib/api";
import type { MarketItem } from "@/lib/types";
import { Card, ErrorNote } from "./ui";

export default function Market({ caseName, rewound }: { caseName: string; rewound: boolean }) {
  const [items, setItems] = useState<MarketItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getMarket(caseName)
      .then((r) => { if (live) { setItems(r.items); setError(null); } })
      .catch((e) => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [caseName]);

  return (
    <Card title="Market today" aside="Public market context (Tavily)">
      {rewound && (
        <p className="mb-3 rounded-md bg-canvas px-2 py-1.5 text-xs text-muted">
          Market data is current; company data is rewound to Q3 2024.
        </p>
      )}
      <ErrorNote message={error} />
      {!items && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
            </div>
          ))}
          <p className="text-xs text-faint">Searching public sources (first load takes a few seconds)...</p>
        </div>
      )}
      {items && (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className={i > 0 ? "border-t border-line pt-3" : ""}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{it.query}</div>
              <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug" title={it.answer ?? undefined}>
                {it.answer ?? <span className="text-muted">No summary returned.</span>}
              </p>
              {it.sources.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  {it.sources.slice(0, 3).map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="max-w-full truncate text-accent hover:underline">
                      {s.title || s.url}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
