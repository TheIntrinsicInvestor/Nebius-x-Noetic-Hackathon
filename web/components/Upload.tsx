"use client";

import { useEffect, useState } from "react";
import { createCompany, errorMessage } from "@/lib/api";
import { comparatorLabel, covValue, kindLabel, modelName, quarterLabel, seconds, usd } from "@/lib/format";
import type { CaseName, CompanyResponse } from "@/lib/types";
import { Card, ErrorNote, Spinner } from "./ui";

// Samples replay the upload flow: fields type in, file names drop in, the progress bar plays, then the cached case loads.
type Sample = {
  name: CaseName;
  label: string;
  fields: { name: string; sector: string; country: string; lender: string; currency: string; unit: string };
  agreement: string;
  financials: string;
  budget?: string;
};

const SAMPLES: Sample[] = [
  {
    name: "nortech", label: "US electronics manufacturer (public filings)",
    fields: { name: "Nortech Systems Inc.", sector: "electronics manufacturing", country: "United States", lender: "Bank of America", currency: "$", unit: "thousands" },
    agreement: "credit_agreement_2024-03.htm", financials: "nortech_quarterly_accounts.xlsx",
  },
  {
    name: "sample_uk", label: "UK engineering firm",
    fields: { name: "Ashby & Rowe Engineering Ltd", sector: "engineering manufacturing", country: "UK", lender: "UK high street banks", currency: "£", unit: "thousands" },
    agreement: "facility_agreement.txt", financials: "ashby_rowe_management_accounts.xlsx", budget: "ashby_rowe_budget_fy27.xlsx",
  },
];

const PLAY_MS = 8000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const placeholderFile = (n: string) => new File([], n);

const CATEGORY: Record<string, string> = {
  revenue: "Revenue", cogs: "Direct costs", opex: "Overheads", da: "Depreciation", interest: "Interest",
  capex: "Capex", cash: "Cash", debt: "Debt", receivables: "Debtors", inventory: "Stock", payables: "Creditors",
  principal: "Loan repayments", addbacks: "One-off items", other: "Other",
};

const input = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none";

export default function Upload({ onLoad, loading, error }: {
  onLoad: (name: CaseName) => void;
  loading: string | null;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [lender, setLender] = useState("");
  const [currency, setCurrency] = useState("$");
  const [unit, setUnit] = useState("thousands");
  const [agreement, setAgreement] = useState<File | null>(null);
  const [financials, setFinancials] = useState<File | null>(null);
  const [budget, setBudget] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyResponse | null>(null);

  const [playing, setPlaying] = useState(false);
  const busy = working || playing;
  const ready = name.trim() && agreement && financials && !busy;

  async function typeInto(set: (v: string) => void, text: string) {
    for (let i = 1; i <= text.length; i++) {
      set(text.slice(0, i));
      await wait(28);
    }
  }

  async function playSample(s: Sample) {
    if (busy) return;
    setPlaying(true);
    setResult(null);
    setUploadError(null);
    [setName, setSector, setCountry, setLender].forEach((f) => f(""));
    setAgreement(null);
    setFinancials(null);
    setBudget(null);
    setCurrency(s.fields.currency);
    setUnit(s.fields.unit);
    await typeInto(setName, s.fields.name);
    await typeInto(setSector, s.fields.sector);
    await typeInto(setCountry, s.fields.country);
    await typeInto(setLender, s.fields.lender);
    await wait(300);
    setAgreement(placeholderFile(s.agreement));
    await wait(350);
    setFinancials(placeholderFile(s.financials));
    if (s.budget) {
      await wait(350);
      setBudget(placeholderFile(s.budget));
    }
    await wait(900);
    setWorking(true);
    await wait(PLAY_MS);
    setWorking(false);
    setPlaying(false);
    onLoad(s.name);
  }

  async function analyse() {
    if (!ready) return;
    const form = new FormData();
    form.append("name", name.trim());
    form.append("sector", sector);
    form.append("country", country);
    form.append("lender", lender);
    form.append("currency", currency);
    form.append("unit", unit);
    form.append("agreement", agreement);
    form.append("financials", financials);
    if (budget) form.append("budget", budget);
    setWorking(true);
    setUploadError(null);
    setResult(null);
    try {
      setResult(await createCompany(form));
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-7 space-y-4">
        <p className="text-sm text-muted max-w-xl">
          Upload your loan agreement and management accounts. NorthStar reads the covenants, maps your accounts, projects
          the next six quarters and shows how close each covenant is to breaking.
        </p>
        <Card title="1. Company">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ashby & Rowe Engineering" /></Field>
            <Field label="Sector"><input className={input} value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. engineering manufacturing" /></Field>
            <Field label="Country"><input className={input} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. UK" /></Field>
            <Field label="Lender"><input className={input} value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. HSBC" /></Field>
            <Field label="Currency">
              <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="$">US dollar ($)</option>
                <option value="£">Pound sterling (£)</option>
                <option value="€">Euro (€)</option>
              </select>
            </Field>
            <Field label="Amounts in the accounts">
              <select className={input} value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="thousands">Thousands</option>
                <option value="millions">Millions</option>
                <option value="units">Units</option>
              </select>
            </Field>
          </div>
        </Card>
        <Card title="2. Documents">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Drop label="Loan or facility agreement" hint=".htm or .txt" accept=".htm,.html,.txt" file={agreement} onFile={setAgreement} />
            <Drop label="Management accounts" hint=".xlsx, accounts down the side, months or quarters across" accept=".xlsx" file={financials} onFile={setFinancials} />
          </div>
          <div className="mt-3">
            <Drop label="Budget or internal forecast (optional)" hint=".xlsx, same layout; adds planned spend and events. Without it NorthStar projects the trend" accept=".xlsx" file={budget} onFile={setBudget} />
          </div>
          <button
            onClick={analyse}
            disabled={!ready}
            className="mt-4 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {working ? <span className="inline-flex items-center gap-2"><Spinner /> Analysing with an open model...</span> : "Analyse"}
          </button>
          {working && <Steps hasBudget={!!budget} stepMs={playing ? PLAY_MS / 5 : undefined} />}
          <div className="mt-3"><ErrorNote message={uploadError} /></div>
        </Card>
        <p className="text-xs text-muted">
          No files to hand? Try a sample company:{" "}
          {SAMPLES.map((s, i) => (
            <span key={s.name}>
              {i > 0 && " · "}
              <button onClick={() => playSample(s)} disabled={busy || loading !== null} className="text-accent underline underline-offset-2 disabled:opacity-50">
                {s.label}
              </button>
            </span>
          ))}
        </p>
        <ErrorNote message={error} />
      </div>

      <div className="col-span-12 lg:col-span-5">
        {result ? (
          <Result result={result} currency={currency} onContinue={() => onLoad(result.case)} loading={loading !== null} />
        ) : (
          <Card title="What happens to your data">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>The agreement text and your account line names are read by an open-weight model, which can run inside your own environment.</li>
              <li>Every number on the dashboard is calculated by a deterministic covenant engine, not by the model.</li>
              <li>Web searches for market context carry only public details: sector, country, lender and base rate.</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// The API returns one response with no progress events, so steps advance on a timer
// and hold on the last one until the response arrives (the component then unmounts).
const STEP_MS = 6000;

function Steps({ hasBudget, stepMs = STEP_MS }: { hasBudget: boolean; stepMs?: number }) {
  const steps = [
    "Locating the covenant section",
    "Extracting covenant terms",
    hasBudget ? "Mapping accounts and budget lines" : "Mapping account lines",
    "Building quarters",
    "Running the covenant engine",
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), stepMs);
    return () => clearInterval(t);
  }, [steps.length, stepMs]);
  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full bg-navy transition-[width] ease-linear ${i === step ? "animate-pulse" : ""}`}
              style={{ width: i < step ? "100%" : i === step ? "60%" : "0%", transitionDuration: i === step ? `${stepMs}ms` : "300ms" }}
            />
          </div>
        ))}
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i < step ? "text-muted" : i === step ? "font-medium text-ink" : "text-faint"}`}>
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              i < step ? "bg-navy text-white" : i === step ? "border-2 border-navy" : "border border-line"
            }`}>
              {i < step ? "✓" : ""}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Drop({ label, hint, accept, file, onFile }: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0] ?? null); }}
      className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-4 text-center text-sm transition ${
        over ? "border-accent bg-accent-soft" : file ? "border-ok bg-ok-soft" : "border-line bg-canvas hover:border-accent"
      }`}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <span className="font-medium text-ink">{label}</span>
      <span className="mt-1 break-all text-xs text-muted">{file ? file.name : `Drop or choose a file (${hint})`}</span>
    </label>
  );
}

function Result({ result, currency, onContinue, loading }: {
  result: CompanyResponse;
  currency: string;
  onContinue: () => void;
  loading: boolean;
}) {
  const { agreement: a, financials: f } = result.stats;
  return (
    <Card title="Read by an open model">
      <div className="space-y-4 text-sm">
        <div>
          <div className="rounded-md bg-accent-soft px-3 py-2 text-accent num">
            Agreement read by {modelName(a.model)} in {seconds(a.latency_s)} for {usd(a.cost_usd)}
          </div>
          <ul className="mt-2 divide-y divide-line">
            {result.covenants.covenants.map((c, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span className="font-medium">{kindLabel(c.kind)}</span>
                <span className="num text-muted">
                  {comparatorLabel(c.comparator)} {c.threshold == null ? "(not found)" : covValue(c.kind, c.threshold, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="rounded-md bg-accent-soft px-3 py-2 text-accent num">
            {result.mapping.length} account lines mapped in {seconds(f.latency_s)} for {usd(f.cost_usd)}, {result.quarters} quarters built
          </div>
          <p className="mt-2 text-xs text-muted">
            {result.budget_until
              ? `Forecast uses your budget for ${result.budget_quarters} quarter${result.budget_quarters === 1 ? "" : "s"} (to ${quarterLabel(result.budget_until)}), then the trend.`
              : "No budget uploaded: the forecast projects the trend from your last 4 quarters."}
          </p>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {result.mapping.map((m) => (
                <tr key={m.name} className="border-b border-line last:border-0">
                  <td className="py-1 pr-2 text-ink">{m.name}</td>
                  <td className="py-1 text-right text-muted">{CATEGORY[m.category] ?? m.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={onContinue}
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Review covenants
        </button>
      </div>
    </Card>
  );
}
