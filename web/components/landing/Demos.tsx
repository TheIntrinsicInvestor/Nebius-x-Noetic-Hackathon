"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Animated explainers for the landing page. Every number below is real engine output for the
// Hartley & Finch sample (u-hartley-finch-packaging), captured 24 Oct 2026; none is interpolated.

const NAVY = "#0e2742";
const TEAL = "#1a8fa6";
const LIMIT = "#5a6a74";
const BREACH = "#b42318";
const OK = "#0b6b4f";

/* ---------- What-if: customers paying faster, one real engine run per 5-day step ---------- */

const QUARTERS = ["Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26", "Q4 26", "Q1 27", "Q2 27", "Q3 27", "Q4 27", "Q1 28"];
const ACTUAL = [2.06, 2.09, 2.16, 2.26, 2.37, 2.48, 2.57, 2.66, 2.75];
// limit: 3.25x to Q3 2026, then the step-down to 2.50x
const LIMITS = QUARTERS.map((_, i) => (i < 9 ? 3.25 : 2.5));
const STEPS: { days: number; forecast: number[] }[] = [
  { days: 0, forecast: [3.13, 3.12, 3.04, 2.92, 2.67, 2.51] },
  { days: -5, forecast: [3.0, 2.98, 2.9, 2.78, 2.53, 2.38] },
  { days: -10, forecast: [2.86, 2.85, 2.75, 2.64, 2.4, 2.25] },
  { days: -15, forecast: [2.73, 2.71, 2.61, 2.49, 2.27, 2.12] },
  { days: -20, forecast: [2.59, 2.57, 2.47, 2.35, 2.14, 1.99] },
  { days: -25, forecast: [2.46, 2.43, 2.33, 2.21, 2.0, 1.86] },
];

const W = 600, H = 250, PL = 40, PR = 22, PT = 16, PB = 28, YMIN = 1.5, YMAX = 3.5;
const x = (i: number) => PL + (i * (W - PL - PR)) / (QUARTERS.length - 1);
const y = (v: number) => PT + ((YMAX - v) * (H - PT - PB)) / (YMAX - YMIN);
const line = (pts: [number, number][]) => pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

export function WhatIfDemo() {
  // the slider snaps to the 5-day steps we have real engine runs for
  const [step, setStep] = useState(0);

  const s = STEPS[step];
  const firstBreach = s.forecast.findIndex((v) => v > 2.5);
  const fc: [number, number][] = [[8, ACTUAL[8]], ...s.forecast.map((v, j) => [9 + j, v] as [number, number])];
  const limitPath = `M${x(0)},${y(3.25)} L${x(8.5)},${y(3.25)} L${x(8.5)},${y(2.5)} L${x(14)},${y(2.5)}`;
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-[0_24px_60px_-28px_rgba(14,39,66,0.35)] sm:p-5">
      {/* taller on phones, where the headline wraps to two lines */}
      <div className="h-[84px] sm:h-[64px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={firstBreach >= 0 ? "breach" : "clear"}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {firstBreach >= 0 ? (
              <>
                <div className="font-serif text-[20px] font-semibold leading-snug text-breach sm:text-[22px]">Projected breach: Leverage in Q4 2026</div>
                <div className="text-sm text-muted num">Forecast {s.forecast[firstBreach].toFixed(2)}x against a 2.50x limit</div>
              </>
            ) : (
              <>
                <div className="font-serif text-[20px] font-semibold leading-snug text-ok sm:text-[22px]">No breach projected in the next 6 quarters</div>
                <div className="text-sm text-muted num">Lowest headroom 2% in Q4 2026</div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the viewBox scales to about half size on a phone, so axis labels are drawn larger there */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full max-sm:[&_text]:text-[18px]" role="img" aria-label="Leverage forecast falling below the 2.50x limit as customers pay faster">
        <rect x={x(8.5)} y={PT} width={x(14) - x(8.5) + PR} height={H - PT - PB} fill="#eaf4f8" />
        <text x={x(8.5) + 6} y={PT + 12} fontSize="11" fill="#8a979f">Forecast</text>
        {[2, 2.5, 3, 3.5].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#eef1f3" />
            <text x={PL - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill={LIMIT}>{v.toFixed(1)}x</text>
          </g>
        ))}
        {QUARTERS.map((q, i) => (i % 2 === 0 ? <text key={q} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill={LIMIT}>{q}</text> : null))}
        <path d={limitPath} stroke={LIMIT} strokeWidth="1.5" fill="none" />
        <path d={line(ACTUAL.map((v, i) => [i, v]))} stroke={NAVY} strokeWidth="2" fill="none" />
        {ACTUAL.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={NAVY} strokeWidth="2" />)}
        <motion.path initial={false} animate={{ d: line(fc) }} transition={{ duration: 0.45, ease: "easeOut" }} stroke={TEAL} strokeWidth="2" strokeDasharray="5 4" fill="none" />
        {s.forecast.map((v, j) => {
          const bad = v > LIMITS[9 + j];
          return (
            <motion.circle
              key={j} cx={x(9 + j)} initial={false}
              animate={{ cy: y(v), r: bad ? 4.5 : 3, fill: bad ? BREACH : "#ffffff", stroke: bad ? BREACH : TEAL }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <div className="mt-3 border-t border-line pt-4">
        <label htmlFor="whatif-demo" className="flex justify-between text-sm">
          <span className="font-medium">Customers pay faster</span>
          <span className={`font-semibold num ${s.days ? "text-ok" : "text-muted"}`}>{s.days ? `${s.days} days` : "0 days"}</span>
        </label>
        <input
          id="whatif-demo"
          type="range"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-label="Customers pay faster"
          aria-valuetext={`${s.days} days`}
          className="mt-2 w-full cursor-pointer"
        />
        <div className="flex justify-between text-xs text-faint">
          <span>As today</span>
          <span>25 days faster</span>
        </div>
        {step === 0 && <p className="mt-2 text-sm text-muted">Drag the slider to see what faster collections do to the forecast.</p>}
      </div>
    </div>
  );
}

/* ---------- Extraction: the real leverage clause from the sample agreement ---------- */

const CLAUSE: { text: string; mark?: number }[] = [
  { text: "Leverage", mark: 0 },
  { text: " in respect of any Relevant Period shall " },
  { text: "not exceed 3.25:1", mark: 1 },
  { text: " for each Relevant Period ending on or before " },
  { text: "30 September 2026", mark: 2 },
  { text: " and " },
  { text: "2.50:1 thereafter", mark: 3 },
  { text: "." },
];

const FIELDS = [
  { label: "Covenant", value: "Leverage (Debt / EBITDA)" },
  { label: "Rule", value: "must stay below 3.25x" },
  { label: "Applies until", value: "30 Sep 2026" },
  { label: "Step-down", value: "From 1 Oct 2026: 2.50x" },
];

export function ExtractDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduce) { setShown(FIELDS.length); return; }
    if (!inView) return;
    const ts = FIELDS.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * 900));
    return () => ts.forEach(clearTimeout);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="rounded-lg border border-line bg-surface p-6 shadow-[0_24px_60px_-28px_rgba(14,39,66,0.35)]">
      <div className="text-xs font-semibold text-faint">facility_agreement.txt</div>
      <p className="mt-2 font-serif text-[19px] leading-relaxed">
        &ldquo;
        {CLAUSE.map((c, i) =>
          c.mark === undefined ? (
            <span key={i}>{c.text}</span>
          ) : (
            <span key={i} className="relative">
              <motion.span
                aria-hidden
                className="absolute -inset-x-0.5 inset-y-0.5 -z-0 rounded-sm bg-teal-soft"
                initial={false}
                animate={{ opacity: shown > c.mark ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative">{c.text}</span>
            </span>
          ),
        )}
        &rdquo;
      </p>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
        {FIELDS.map((f, i) => (
          <div key={f.label}>
            <div className="text-xs text-muted">{f.label}</div>
            <motion.div
              className="mt-1 text-[15px] font-semibold num"
              initial={false}
              animate={{ opacity: shown > i ? 1 : 0, y: shown > i ? 0 : 6 }}
              transition={{ duration: 0.35 }}
            >
              {f.value}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Ask NorthStar: one real question and the model's verbatim answer ---------- */

const QUESTION = "Customers are paying us 10 days later. What happens to our covenants?";
// DeepSeek V4.1 Flash via /ask, 24 Oct 2026: 4 engine runs, 3.1 s, $0.0020, no unverified numbers.
const ANSWER = [
  "Yes, it breaches. Even in the base case leverage reaches 3.13 against a 2.5 limit in Q4 2026. With customers paying 10 days later, leverage rises to 3.40, first breaching in Q4 2026 and worsening to 3.40 in Q1 2027, 36% over the limit. Interest cover stays safe at 4.36 versus 3.0.",
  "Cutting £10m of capex only lowers leverage to 2.92, still above 2.5, so you need a larger cash release, such as deeper capex cuts plus tighter collections.",
];

export function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "thinking" | "answered">("typing");

  useEffect(() => {
    if (reduce) { setTyped(QUESTION.length); setPhase("answered"); return; }
    if (!inView) return;
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const type = () => {
      i += 1;
      setTyped(i);
      if (i < QUESTION.length) timers.push(setTimeout(type, 28));
      else {
        timers.push(setTimeout(() => setPhase("thinking"), 400));
        timers.push(setTimeout(() => setPhase("answered"), 2200));
      }
    };
    timers.push(setTimeout(type, 400));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  const sent = phase !== "typing";
  return (
    <div ref={ref} className="rounded-lg border border-line bg-canvas p-4">
      {/* An invisible copy of the finished conversation shares the grid cell, so the box is
          the final height from the start at every width and never grows mid-animation. */}
      <div className="grid">
      <div aria-hidden className="invisible col-start-1 row-start-1 space-y-3">
        <div className="ml-10 rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">{QUESTION}</div>
        <div className="mr-4 rounded-2xl rounded-bl-sm border border-l-4 p-3">
          <div className="space-y-2 text-sm leading-relaxed">{ANSWER.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
          <p className="mt-2 text-xs">Checked against the engine: ran 4 scenarios in 3.1s for $0.0020</p>
        </div>
      </div>
      <div className="col-start-1 row-start-1 space-y-3">
        {sent && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-10 rounded-2xl rounded-br-sm bg-navy px-3.5 py-2 text-sm text-white">
            {QUESTION}
          </motion.div>
        )}
        {phase === "thinking" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
            Running scenarios through the engine...
          </p>
        )}
        {phase === "answered" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="mr-4 rounded-2xl rounded-bl-sm border border-line border-l-4 border-l-teal bg-surface p-3"
          >
            <div className="space-y-2 text-sm leading-relaxed">{ANSWER.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
            <p className="mt-2 text-xs text-faint">Checked against the engine: ran 4 scenarios in 3.1s for $0.0020</p>
          </motion.div>
        )}
      </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="min-h-[38px] min-w-0 flex-1 truncate rounded-full border border-line bg-surface px-4 py-2 text-sm">
          {sent ? <span className="text-faint">Ask about this company&apos;s covenants</span> : <>{QUESTION.slice(0, typed)}<span className="animate-pulse">|</span></>}
        </div>
        <span className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">Ask</span>
      </div>
    </div>
  );
}

/* ---------- Track record: the timeline rule draws across before the stops appear ---------- */

export function TimelineRule() {
  return (
    <>
      <motion.div
        aria-hidden
        className="absolute left-0 right-0 top-[7px] hidden h-px origin-left bg-line md:block"
        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-2 left-[7px] top-2 w-px origin-top bg-line md:hidden"
        initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </>
  );
}
