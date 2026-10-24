"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// The 55-second launch film (brag-output/brag.mp4). It can't autoplay with sound, so the hero keeps
// its screenshot and two buttons open the film in a lightbox.

const OPEN = "northstar:film";
const openFilm = () => window.dispatchEvent(new Event(OPEN));

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}

/** Text link beside the hero CTA. */
export function FilmLink() {
  return (
    <button
      type="button"
      onClick={openFilm}
      className="group inline-flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap text-navy transition-colors hover:text-teal"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-navy/30 transition-colors group-hover:border-teal">
        <PlayIcon className="ml-0.5 h-3.5 w-3.5" />
      </span>
      Watch the film (55 s)
    </button>
  );
}

/** Play badge laid over the hero screenshot. */
export function FilmBadge() {
  return (
    <button
      type="button"
      onClick={openFilm}
      aria-label="Watch the film, 55 seconds"
      className="group absolute inset-0 flex items-center justify-center rounded-lg bg-navy/0 transition-colors duration-200 hover:bg-navy/10"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy/90 text-white shadow-[0_12px_32px_-8px_rgba(14,39,66,0.6)] ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105 sm:h-20 sm:w-20">
        <PlayIcon className="ml-1 h-6 w-6 sm:h-8 sm:w-8" />
      </span>
    </button>
  );
}

/** The lightbox. Mount once on the page. */
export function FilmModal() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const onOpen = () => { opener.current = document.activeElement; setOpen(true); };
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="NorthStar film"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111d]/90 p-4 sm:p-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-[1280px]"
            initial={{ scale: 0.97 }} animate={{ scale: 1 }} exit={{ scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <video
              src="/landing/film.mp4"
              poster="/landing/film-poster.jpg"
              controls
              autoPlay
              playsInline
              className="aspect-video w-full rounded-lg bg-black shadow-2xl"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
