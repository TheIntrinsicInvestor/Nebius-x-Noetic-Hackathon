"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { covValue, headroomTone, isMoneyKind, isUndefinedRatio, kindLabel, pct, quarterLabel } from "@/lib/format";
import type { CovenantPoint } from "@/lib/types";
import { Pill } from "./ui";

const ACCENT = "#0e2742";
const FORECAST = "#1a8fa6";
const LIMIT = "#5a6a74";
const BREACH = "#b42318";

interface Row {
  label: string;
  actual: number | null;
  forecast: number | null;
  threshold: number;
  p: CovenantPoint;
  off: "high" | "low" | null;
  /** first point of a run of clipped points: the only one that carries the "off chart" text */
  offLabel: boolean;
}

function bounds(kind: string, comparator: string, pts: CovenantPoint[]) {
  const maxThr = Math.max(...pts.map((p) => p.threshold));
  const finite = pts.map((p) => p.value).filter((v) => !isUndefinedRatio(v));
  const maxVal = finite.length ? Math.max(...finite) : 0;
  // "Must stay below" ratios blow up when EBITDA nears zero: cap at 2x the limit.
  let cap = 2 * maxThr;
  // Money EBITDA does not blow up, so show its real range.
  if (isMoneyKind(kind)) cap = Math.max(cap, 1.15 * maxVal);
  // "Must stay above" ratios sit far above a low limit when healthy: allow up to 10x the limit.
  else if (comparator === "min") cap = Math.max(cap, Math.min(1.15 * maxVal, 10 * maxThr));
  const minVal = finite.length ? Math.min(...finite) : 0;
  const floor = Math.max(Math.min(0, minVal * 1.1), -cap / 2);
  return { cap, floor };
}

export default function HeadroomChart({ kind, comparator, points, currency }: {
  kind: string;
  comparator: string;
  points: CovenantPoint[];
  currency: string;
}) {
  const pts = [...points].sort((a, b) => a.period_end.localeCompare(b.period_end));
  if (pts.length === 0) return null;
  const { cap, floor } = bounds(kind, comparator, pts);
  const lastActualIdx = pts.map((p) => p.is_forecast).lastIndexOf(false);

  const rows: Row[] = pts.map((p, i) => {
    const v = isUndefinedRatio(p.value) ? cap * 10 : p.value;
    const off = v > cap ? "high" : v < floor ? "low" : null;
    // keep clipped points just inside the plot so the dot and its label stay visible
    const inset = (cap - floor) * 0.09;
    const shown = off === "high" ? cap - inset : off === "low" ? floor + inset : v;
    return {
      label: quarterLabel(p.period_end),
      actual: !p.is_forecast ? shown : null,
      forecast: p.is_forecast || i === lastActualIdx ? shown : null,
      threshold: p.threshold,
      p,
      off,
      offLabel: false,
    };
  });
  rows.forEach((r, i) => { r.offLabel = !!r.off && (i === 0 || rows[i - 1].off !== r.off); });

  const latest = lastActualIdx >= 0 ? pts[lastActualIdx] : null;
  const fc = pts.filter((p) => p.is_forecast);
  const worst = fc.length ? fc.reduce((a, b) => (b.headroom_pct < a.headroom_pct ? b : a)) : null;
  const firstFc = rows.find((r) => r.p.is_forecast);
  const fmt = (v: number) => covValue(kind, v, currency);
  const tick = (v: number) => (isMoneyKind(kind) ? `${currency}${v.toFixed(1)}m` : `${v.toFixed(1)}x`);

  const dot = (series: "actual" | "forecast") =>
    function DotRenderer(props: { cx?: number; cy?: number; index?: number; payload?: Row }) {
      const { cx, cy, index, payload } = props;
      const key = `${series}-${index}`;
      if (cx == null || cy == null || !payload) return <g key={key} />;
      if (series === "forecast" && !payload.p.is_forecast) return <g key={key} />;
      const color = payload.p.breached ? BREACH : series === "forecast" ? FORECAST : ACCENT;
      return (
        <g key={key}>
          <circle cx={cx} cy={cy} r={payload.p.breached ? 4.5 : 3} fill={payload.p.breached ? BREACH : "#fff"} stroke={color} strokeWidth={2} />
          {payload.off && (
            <path
              d={payload.off === "high" ? `M${cx - 3.5},${cy - 7} L${cx + 3.5},${cy - 7} L${cx},${cy - 12} Z` : `M${cx - 3.5},${cy + 7} L${cx + 3.5},${cy + 7} L${cx},${cy + 12} Z`}
              fill={color}
            />
          )}
          {payload.offLabel && (
            <text x={index === rows.length - 1 ? cx - 4 : cx + 4} y={payload.off === "high" ? cy + 17 : cy - 11} textAnchor={index === rows.length - 1 ? "end" : "start"} fontSize={10} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
              off chart
            </text>
          )}
        </g>
      );
    };

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div>
          <h3 className="text-[13px] font-semibold">{kindLabel(kind)}</h3>
          <p className="text-xs text-muted num">
            {pts[0].threshold === pts[pts.length - 1].threshold
              ? `Limit ${fmt(pts[0].threshold)}`
              : `Limit steps from ${fmt(pts[0].threshold)} to ${fmt(pts[pts.length - 1].threshold)}`}
          </p>
        </div>
      </div>
      <div className="h-[200px] px-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 26, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#eef1f3" vertical={false} />
            {firstFc && (
              <ReferenceArea
                x1={firstFc.label}
                x2={rows[rows.length - 1].label}
                fill="#eaf4f8"
                fillOpacity={1}
                label={{ value: "Forecast", position: "top", fontSize: 10, fill: "#8a979f" }}
              />
            )}
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5a6a74" }} tickLine={false} axisLine={{ stroke: "#dde3e7" }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis domain={[floor, cap]} ticks={[0, 1, 2, 3, 4].map((i) => floor + ((cap - floor) * i) / 4)} allowDataOverflow tick={{ fontSize: 10, fill: "#5a6a74" }} tickFormatter={tick} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "#c3ccd2", strokeWidth: 1 }}
              content={(tp) => {
                const row = (tp.payload?.[0]?.payload ?? null) as Row | null;
                if (!tp.active || !row) return null;
                return <Tip row={row} fmt={fmt} />;
              }}
            />
            <Line type="stepAfter" dataKey="threshold" stroke={LIMIT} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="actual" stroke={ACCENT} strokeWidth={2} dot={dot("actual")} activeDot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="forecast" stroke={FORECAST} strokeWidth={2} strokeDasharray="5 4" dot={dot("forecast")} activeDot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted num">
        {latest && (
          <span>
            Headroom at {quarterLabel(latest.period_end)} (latest actual):{" "}
            <Pill tone={headroomTone(latest.headroom_pct)}>{pct(latest.headroom_pct)}</Pill>
          </span>
        )}
        {worst && (
          <span>
            Lowest in forecast: <Pill tone={headroomTone(worst.headroom_pct)}>{pct(worst.headroom_pct)}</Pill> in {quarterLabel(worst.period_end)}
          </span>
        )}
      </div>
    </div>
  );
}

function Tip({ row, fmt }: { row: Row; fmt: (v: number) => string }) {
  const p = row.p;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md num">
      <div className="font-semibold">{row.label} {p.is_forecast ? "(forecast)" : "(actual)"}</div>
      <div className="mt-1 flex justify-between gap-4"><span className="text-muted">Value</span><span>{fmt(p.value)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-muted">Limit</span><span>{fmt(p.threshold)}</span></div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Headroom</span>
        <span className={p.breached ? "font-semibold text-breach" : ""}>{pct(p.headroom_pct)}{p.breached ? " (breach)" : ""}</span>
      </div>
      {row.off && <div className="mt-1 text-faint">Shown at the chart edge (off chart)</div>}
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted">
      <span className="flex items-center gap-1"><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={ACCENT} strokeWidth="2" /></svg>Actual</span>
      <span className="flex items-center gap-1"><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={FORECAST} strokeWidth="2" strokeDasharray="4 3" /></svg>Forecast</span>
      <span className="flex items-center gap-1"><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={LIMIT} strokeWidth="1.5" /></svg>Limit</span>
      <span className="flex items-center gap-1"><svg width="8" height="8"><circle cx="4" cy="4" r="3.5" fill={BREACH} /></svg>Breach</span>
    </div>
  );
}
