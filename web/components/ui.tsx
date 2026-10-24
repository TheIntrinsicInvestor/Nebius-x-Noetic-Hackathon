import type { ReactNode } from "react";
import type { Tone } from "@/lib/format";

export function Card({ title, aside, children, className = "" }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="flex items-center gap-2 font-serif text-[16px] font-semibold text-ink">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-teal" />
            {title}
          </h2>
          {aside && <div className="text-xs text-muted">{aside}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-breach/30 bg-breach-soft px-3 py-2 text-sm text-breach">
      {message}
    </div>
  );
}

const TONE_CLASS: Record<Tone, string> = {
  breach: "bg-breach-soft text-breach",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold num ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Quote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">From the agreement</div>
      <p className="mt-0.5 text-xs italic leading-relaxed text-muted">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal/30 border-t-teal align-[-2px]" />
  );
}
