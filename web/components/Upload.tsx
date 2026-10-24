"use client";

import { useState } from "react";
import { errorMessage, uploadAgreement } from "@/lib/api";
import { comparatorLabel, covValue, dateLabel, kindLabel, modelName, seconds, usd } from "@/lib/format";
import type { AgreementResponse, CaseName, CovenantSet } from "@/lib/types";
import { Card, ErrorNote, Quote, Spinner } from "./ui";

const CASES: { name: CaseName; title: string; sub: string }[] = [
  {
    name: "nortech",
    title: "Load Nortech Systems (real SEC filings)",
    sub: "US contract manufacturer with a $15m revolver. Breached a covenant in 2025 and needed a waiver from its bank.",
  },
  {
    name: "sample_uk",
    title: "Load sample UK client (Ashby & Rowe Engineering)",
    sub: "Illustrative UK engineering firm, £18m facility on SONIA, management accounts in Excel.",
  },
];

export default function Upload({ onLoad, loading, error }: {
  onLoad: (name: CaseName, covenants?: CovenantSet) => void;
  loading: string | null;
  error: string | null;
}) {
  const [result, setResult] = useState<AgreementResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setUploadError(null);
    setResult(null);
    try {
      setResult(await uploadAgreement(file));
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-7 space-y-4">
        <p className="text-sm text-muted max-w-xl">
          Start with a company. NorthStar reads the loan agreement, projects the next six quarters and shows how close each
          covenant is to breaking.
        </p>
        {CASES.map((c) => (
          <button
            key={c.name}
            onClick={() => onLoad(c.name)}
            disabled={loading !== null}
            className="group block w-full rounded-lg border border-line bg-surface px-5 py-4 text-left transition hover:border-accent hover:shadow-sm disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-ink group-hover:text-accent">{c.title}</span>
              {loading === c.name ? <Spinner /> : <span className="text-accent text-sm">Load</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{c.sub}</p>
          </button>
        ))}
        <ErrorNote message={error} />
      </div>

      <div className="col-span-12 lg:col-span-5">
        <Card title="Upload a credit agreement (.htm/.txt)">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-line bg-canvas px-4 py-6 text-sm text-muted hover:border-accent">
            <input
              type="file"
              accept=".htm,.html,.txt"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {uploading ? (
              <span className="flex items-center gap-2"><Spinner /> Reading {fileName} with an open model...</span>
            ) : (
              <span>{fileName ? `Choose another file (last: ${fileName})` : "Choose a file to extract its covenants"}</span>
            )}
          </label>
          <div className="mt-3"><ErrorNote message={uploadError} /></div>
          {result && <Extracted result={result} onLoad={onLoad} loading={loading} />}
        </Card>
      </div>
    </div>
  );
}

function Extracted({ result, onLoad, loading }: {
  result: AgreementResponse;
  onLoad: (name: CaseName, covenants?: CovenantSet) => void;
  loading: string | null;
}) {
  const { covenants, stats } = result;
  const f = covenants.facility;
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent num">
        Read by {modelName(stats.model)} in {seconds(stats.latency_s)} for {usd(stats.cost_usd)}
        <span className="text-xs text-muted"> ({stats.prompt_tokens.toLocaleString()} in, {stats.completion_tokens.toLocaleString()} out tokens)</span>
      </div>
      <ul className="divide-y divide-line">
        {covenants.covenants.map((c, i) => (
          <li key={i} className="py-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{kindLabel(c.kind)}</span>
              <span className="num text-muted">
                {comparatorLabel(c.comparator)} {c.threshold == null ? "(not found)" : covValue(c.kind, c.threshold, "")}
              </span>
            </div>
            <Quote text={c.source_quote} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted num">
        Facility: {f.size ?? "-"}m, matures {dateLabel(f.maturity)}, margin {f.margin_pct ?? "-"}% over {f.base_rate_name ?? "base rate"}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {(["nortech", "sample_uk"] as CaseName[]).map((n) => (
          <button
            key={n}
            onClick={() => onLoad(n, covenants)}
            disabled={loading !== null}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Apply to {n === "nortech" ? "Nortech" : "Ashby & Rowe"} financials
          </button>
        ))}
      </div>
    </div>
  );
}
