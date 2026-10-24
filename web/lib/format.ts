import type { CovenantPoint, Scenario } from "./types";

export const KIND_LABEL: Record<string, string> = {
  leverage: "Leverage (Debt / EBITDA)",
  interest_cover: "Interest cover",
  fixed_charge_cover: "Fixed charge cover",
  min_ebitda: "Minimum EBITDA",
};

export const KIND_SHORT: Record<string, string> = {
  leverage: "Leverage",
  interest_cover: "Interest cover",
  fixed_charge_cover: "Fixed charge cover",
  min_ebitda: "Minimum EBITDA",
};

export const kindLabel = (k: string | null | undefined) => (k ? KIND_LABEL[k] ?? k : "-");
export const kindShort = (k: string | null | undefined) => (k ? KIND_SHORT[k] ?? k : "-");

export const comparatorLabel = (c: string) => (c === "max" ? "must stay below" : "must stay above");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-03-31" -> "Q1 2025" (calendar quarters). */
export function quarterLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  const y = iso.slice(0, 4);
  const m = parseInt(iso.slice(5, 7), 10);
  if (!m) return iso;
  return `Q${Math.ceil(m / 3)} ${y}`;
}

/** "2027-02-28" -> "28 Feb 2027" without timezone drift. */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The engine reports 999 when a ratio is undefined (EBITDA zero or negative). */
export const isUndefinedRatio = (v: number) => !Number.isFinite(v) || v >= 999;

export const ratio = (v: number | null | undefined) =>
  v == null ? "-" : isUndefinedRatio(v) ? "n/a (EBITDA ≤ 0)" : `${v.toFixed(2)}x`;

export const pct = (fraction: number | null | undefined) =>
  fraction == null || !Number.isFinite(fraction) ? "-" : `${Math.round(fraction * 100)}%`;

export const money = (v: number | null | undefined, currency: string) =>
  v == null || !Number.isFinite(v) ? "-" : `${v < 0 ? "-" : ""}${currency}${Math.abs(v).toFixed(1)}m`;

export const isMoneyKind = (kind: string) => kind === "min_ebitda";

/** Format a covenant value in its own unit: ratio "2.10x" or money "$1.6m". */
export function covValue(kind: string, v: number | null | undefined, currency: string): string {
  return isMoneyKind(kind) ? money(v, currency) : ratio(v);
}

export function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  if (v === 0) return "$0";
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${parseFloat(v.toPrecision(3))}`;
}

export function seconds(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "-" : `${v.toFixed(1)}s`;
}

export function modelName(id: string): string {
  return id.split("/").pop() ?? id;
}

export type Tone = "breach" | "warn" | "ok";

export function headroomTone(h: number): Tone {
  if (h < 0) return "breach";
  if (h < 0.1) return "warn";
  return "ok";
}

export const pointLabel = (p: CovenantPoint) => `${kindShort(p.kind)} in ${quarterLabel(p.period_end)}`;

export const isZeroScenario = (s: Scenario) =>
  Object.values(s).every((v) => v === 0);
