"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type QuantityCounterProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  className?: string;
};

/** Smooth − / value / + stepper with animated value swap and press feedback. */
export function QuantityCounter({
  value,
  onChange,
  min = 1,
  max = 99,
  ariaLabel = "Quantity",
  className,
}: QuantityCounterProps) {
  const [bump, setBump] = useState(0); // re-trigger the value pop animation

  useEffect(() => {
    setBump((b) => b + 1);
  }, [value]);

  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) onChange(clamped);
  };

  const btn =
    "grid size-8 place-items-center rounded-lg text-navy transition-all duration-200 ease-out hover:bg-navy hover:text-white active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-navy";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-navy/30 bg-white p-1",
        className
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        className={btn}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 10h10" />
        </svg>
      </button>

      <span
        key={bump}
        aria-live="polite"
        className="min-w-7 animate-[qty-pop_0.22s_ease-out] text-center text-small font-bold text-navy"
      >
        {value}
      </span>

      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        className={btn}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M10 5v10M5 10h10" />
        </svg>
      </button>
    </div>
  );
}
