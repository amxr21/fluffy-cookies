"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: string;
  /** Rendered greyed out and not selectable (e.g. "coming soon"). */
  disabled?: boolean;
  /** Short reason shown beside the label when disabled. */
  note?: string;
};

type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  variant?: "outline" | "solid";
  ariaLabel?: string;
  className?: string;
  wrapperClassName?: string;
};

/**
 * Custom animated dropdown (native <select> can't animate its popup).
 * Smooth open/close, hover-highlighted options, full keyboard support.
 */
export function Dropdown({
  value,
  options,
  onChange,
  variant = "outline",
  ariaLabel,
  className,
  wrapperClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (v: string) => {
    if (options.find((o) => o.value === v)?.disabled) return;
    onChange(v);
    setOpen(false);
  };

  /** Next selectable index in `dir`, skipping disabled options. */
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        const current = options.findIndex((o) => o.value === value);
        setActive(Math.max(0, current));
      } else if (e.key === "Enter" || e.key === " ") {
        choose(options[active].value);
      } else {
        setActive((i) => step(i, 1));
      }
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => step(i, -1));
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-flex", wrapperClassName)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-3 pr-2.5 text-small font-semibold outline-none",
          "transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-navy/40",
          variant === "outline" &&
            "border border-navy/30 bg-white text-navy hover:border-navy hover:bg-navy/5",
          variant === "solid" && "bg-navy text-white hover:bg-navy/90",
          className
        )}
      >
        <span>{selected?.label}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={cn(
            "size-4 transition-transform duration-300 ease-out",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>

      {/* animated popup */}
      <ul
        id={listId}
        role="listbox"
        className={cn(
          "absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-full origin-top overflow-hidden rounded-xl border border-navy/15 bg-white p-1 shadow-xl shadow-navy/10",
          "transition-all duration-200 ease-out",
          open
            ? "visible scale-100 opacity-100"
            : "pointer-events-none invisible -translate-y-1 scale-95 opacity-0"
        )}
      >
        {options.map((opt, i) => {
          const isSelected = opt.value === value;
          return (
            <li
              key={opt.value}
              role="option"
              aria-selected={isSelected}
              aria-disabled={opt.disabled || undefined}
            >
              <button
                type="button"
                disabled={opt.disabled}
                onMouseEnter={() => !opt.disabled && setActive(i)}
                onClick={() => choose(opt.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-small font-medium transition-colors duration-150",
                  opt.disabled
                    ? "cursor-not-allowed text-navy/30"
                    : isSelected
                      ? "text-navy"
                      : "text-navy/70",
                  !opt.disabled && (active === i ? "bg-navy/10" : "hover:bg-navy/5")
                )}
              >
                <span>{opt.label}</span>
                {opt.note && (
                  <span className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-caption font-semibold text-navy/50">
                    {opt.note}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
