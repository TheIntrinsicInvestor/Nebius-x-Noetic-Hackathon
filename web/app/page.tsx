import Image from "next/image";
import Link from "next/link";
import { ChatDemo, ExtractDemo, TimelineRule, WhatIfDemo } from "@/components/landing/Demos";
import { Enter, Reveal } from "@/components/landing/Reveal";

// Landing page for finance directors. Every figure here comes from the README / engine output.

function Cta() {
  return (
    <Link
      href="/app"
      className="group inline-flex items-center gap-2 rounded-md bg-navy px-5 py-3 text-[15px] font-semibold whitespace-nowrap text-white transition duration-150 hover:bg-[#16365a] active:translate-y-px"
    >
      Open NorthStar
      <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">&rarr;</span>
    </Link>
  );
}

function Shot({ src, width, height, alt, priority = false }: { src: string; width: number; height: number; alt: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(14,39,66,0.35)]">
      {/* unoptimized: serve the 2x PNG as captured; Next's lossy re-encode blurred the small UI text */}
      <Image src={src} width={width} height={height} alt={alt} priority={priority} unoptimized className="h-auto w-full" />
    </div>
  );
}

const STEPS = [
  { title: "Your loan agreement", body: "NorthStar finds the covenants, their limits and any step-downs, and quotes the clause each one came from." },
  { title: "Your management accounts", body: "An Excel export with account names down the side. Lines are mapped to revenue, costs and debt, whatever your bookkeeper called them." },
  { title: "Your budget, if you have one", body: "The forecast follows your budget for the quarters it covers, then your recent trend." },
];

const RULE = [
  { title: "Open models read", body: "An open-weight model finds the covenant section and extracts the terms. Only short excerpts are sent, never the whole agreement." },
  { title: "An engine calculates", body: "Covenant tests, the forecast, headroom, stress tests and refinancing timing come from deterministic code you can audit." },
  { title: "Unchecked numbers are removed", body: "Any written insight that quotes a number the engine did not produce is dropped. Chat answers that do so are flagged." },
];

const MODELS = [
  { name: "Claude Opus 5.5", kind: "Closed", right: "16 / 16", cost: "about $0.0175 (estimate)" },
  { name: "DeepSeek V4.1 Flash", kind: "Open", right: "16 / 16", cost: "$0.0053" },
  { name: "MiniMax M3.1 Flash", kind: "Open", right: "16 / 16", cost: "$0.0006" },
];

export default function Landing() {
  return (
    <div className="bg-canvas text-ink">
      {/* Hero: light, with navy kept to the type, the buttons and the app screenshot */}
      {/* flow-root stops the screenshot's negative margin collapsing, so it hangs below the band */}
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center px-4 sm:px-6">
          <span className="font-serif text-[28px] font-bold leading-none tracking-tight">NorthStar</span>
        </div>
      </header>
      <section className="flow-root bg-surface text-ink">
        <div className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-6 lg:pt-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-14">
            <Enter>
              <h1 className="font-serif text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[52px] lg:text-[56px] xl:text-[64px]">
                See the covenant breach before your bank does.
              </h1>
            </Enter>
            <div className="lg:pb-2">
              <Enter delay={0.12}>
                <p className="max-w-[46ch] text-lg leading-relaxed text-muted">
                  Upload your loan agreement and management accounts, or use a built-in sample. NorthStar forecasts every covenant test six quarters ahead.
                </p>
              </Enter>
              <Enter delay={0.24} className="mt-7">
                <Cta />
              </Enter>
            </div>
          </div>
          <Enter delay={0.3} className="relative mt-14 -mb-24 sm:-mb-32 lg:mt-16 lg:-mb-40">
            <Shot
              src="/landing/dashboard.png"
              width={2846}
              height={1800}
              priority
              alt="NorthStar dashboard for a sample UK packaging company: leverage is 2.75x against a 3.25x limit today, with a projected breach in Q4 2026 when the limit steps down to 2.50x."
            />
          </Enter>
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-[1280px] px-4 pb-24 pt-40 sm:pt-48 lg:pt-64 sm:px-6">
        <Reveal>
          <p className="max-w-[26ch] font-serif text-[32px] leading-[1.15] sm:text-[40px]">
            Covenants are tested every quarter. Many finance directors only find out where they stand once the numbers are in.
          </p>
          <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            Break a covenant and the bank can reprice the loan, charge a waiver fee or call it in. Who sees it coming depends on who is watching.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-8 border-t border-line pt-8 md:grid-cols-3 md:gap-10">
          {[
            { who: "Large companies", watch: "A treasury team" },
            { who: "Private equity owned", watch: "The fund's finance people" },
            { who: "Family owned, $50m to $500m revenue", watch: "A finance director and a spreadsheet", you: true },
          ].map((c, i) => (
            <Reveal key={c.who} delay={i * 0.08}>
              <div className={c.you ? "border-l-[3px] border-teal pl-4" : "border-l-[3px] border-transparent pl-4"}>
                <div className="text-sm text-muted">{c.who}</div>
                <div className={`mt-1 font-serif text-2xl ${c.you ? "font-semibold" : ""}`}>{c.watch}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface py-24">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <Reveal>
            <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight">Three files in. Six quarters of covenant tests out.</h2>
            <ol className="mt-10 space-y-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-4">
                  <span className="font-serif text-2xl leading-none text-teal num">{i + 1}</span>
                  <div>
                    <h3 className="text-[17px] font-semibold">{s.title}</h3>
                    <p className="mt-1 max-w-[52ch] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1}>
            <ExtractDemo />
            <p className="mt-3 text-sm text-muted">The leverage clause from a sample agreement. Every covenant comes with the clause it was read from, so you can check it.</p>
          </Reveal>
        </div>
      </section>

      {/* The rule */}
      <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6">
        <Reveal>
          <h2 className="max-w-[24ch] font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-[44px]">
            The language model never produces a number you see.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {RULE.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <h3 className="text-[17px] font-semibold">{r.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{r.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What-ifs */}
      <section className="bg-surface py-24">
        {/* minmax(0,…): the chat's one-line typed question must not widen its column mid-animation */}
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <WhatIfDemo />
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight">Test a decision before you make it.</h2>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-muted">
              Move a slider and every covenant is recalculated: customers paying faster or slower, EBITDA up or down, capex cuts or extra spend, interest rate moves.
            </p>
            <p className="mt-5 max-w-[50ch] border-l-[3px] border-ok pl-4 text-[17px] leading-relaxed">
              In the sample company, collecting from customers 25 days faster avoids the projected Q4 2026 breach.
            </p>
            <h3 className="mt-10 text-[17px] font-semibold">Or ask in plain English</h3>
            <div className="mt-3"><ChatDemo /></div>
            <p className="mt-3 text-sm text-muted">A real answer from the sample company. Answers run your scenarios through the same engine.</p>
          </Reveal>
        </div>
      </section>

      {/* Track record */}
      <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6">
        <Reveal>
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-teal">Track record</div>
          <h2 className="mt-3 max-w-[22ch] font-serif text-4xl font-semibold leading-tight tracking-tight">Replayed on a real company&apos;s filings.</h2>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            Nortech Systems is a US electronics manufacturer with about $120m of revenue, one bank and no private equity owner. We fed NorthStar its SEC filings one quarter at a time and compared the forecast with what happened next.
          </p>
        </Reveal>
        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <TimelineRule />
          {[
            { when: "30 Sep 2024", figure: "1.74x", text: "Leverage against a 2.50x limit. 30% headroom, so it looked fine.", dot: "bg-ok" },
            { when: "NorthStar's forecast", figure: "Q1 2025", text: "A breach, projected from the same filings.", dot: "bg-teal" },
            { when: "What happened", figure: "Q4 2024", text: "Breached at the very next test, again in Q1 2025, then four covenant amendments in under two years.", dot: "bg-breach" },
          ].map((s, i) => (
            <Reveal key={s.when} delay={0.3 + i * 0.35}>
              <div className="relative pl-8 md:pl-0 md:pt-8">
                <span aria-hidden className={`absolute left-0 top-0.5 h-[15px] w-[15px] rounded-full border-[3px] border-canvas ${s.dot}`} />
                <div className="text-sm text-muted">{s.when}</div>
                <div className="mt-1 font-serif text-[44px] font-semibold leading-none num">{s.figure}</div>
                <p className="mt-3 max-w-[34ch] leading-relaxed text-muted">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Open models */}
      <section className="bg-surface py-24">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <Reveal>
            <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight">Open models, deployable privately.</h2>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-muted">
              The reading is done by open-weight models. This demo runs them on a hosted service, but open weights mean a company could run the same models inside its own environment.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[15px] num">
                <thead>
                  <tr className="border-b border-ink/80 text-sm text-muted">
                    <th className="py-3 pr-4 font-medium">Model</th>
                    <th className="py-3 pr-4 font-medium">Covenants read correctly</th>
                    <th className="py-3 font-medium">Cost per document</th>
                  </tr>
                </thead>
                <tbody>
                  {MODELS.map((m) => (
                    <tr key={m.name} className="border-b border-line">
                      <td className="py-3.5 pr-4">
                        <span className="font-semibold">{m.name}</span>
                        <span className="ml-2 text-sm text-muted">{m.kind}</span>
                      </td>
                      <td className="py-3.5 pr-4">{m.right}</td>
                      <td className="py-3.5">{m.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted">
              Same prompt for every model: 16 covenants across 9 real SEC credit documents. Where open models fell short: on a messy redlined amendment, DeepSeek returned an empty answer twice, so redlined drafts still need a human check.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-[1280px] px-4 py-28 sm:px-6">
        <Reveal className="flex flex-col items-start gap-8 border-t-[3px] border-navy pt-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Check your next covenant test.</h2>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">
              Upload your agreement and accounts, or start with a sample company. No account needed.
            </p>
          </div>
          <Cta />
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="font-serif text-lg font-bold text-ink">NorthStar</span>
          <span className="max-w-[70ch]">NorthStar uses reported EBITDA, so it flags the trend rather than your bank&apos;s exact calculation.</span>
        </div>
      </footer>
    </div>
  );
}
