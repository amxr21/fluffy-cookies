import Image from "next/image";

import { ORDER_PHASES, getOrderProgress } from "@/lib/orders";
import { cn } from "@/lib/utils";

/**
 * Phase timeline for an order: "Order placed → Preparing → Ready → Completed".
 *
 * Each phase carries its own Kirby artwork (public/images/kirby/), shown large
 * for the phase the order is currently in. Progress is derived from the raw
 * backend status via `getOrderProgress`, so unknown or renamed statuses still
 * render a sensible timeline instead of an empty one.
 */
export function OrderProgress({ status }: { status: string }) {
  const { currentIndex, cancelled } = getOrderProgress(status);

  if (cancelled) {
    return (
      <div className="rounded-2xl border border-brown/30 bg-brown/5 p-5 text-center">
        <p className="text-h4 font-bold text-brown">Order cancelled</p>
        <p className="mt-1 text-small text-brown/80">
          This order is no longer being prepared. Contact us if that looks wrong.
        </p>
      </div>
    );
  }

  const current = ORDER_PHASES[currentIndex];
  // Fill the connecting rail up to the current phase.
  const pct = (currentIndex / (ORDER_PHASES.length - 1)) * 100;

  return (
    <section aria-label="Order progress" className="rounded-2xl border border-navy/15 bg-white/40 p-5">
      {/* Current phase — the Kirby art carries the state at a glance */}
      <div className="flex items-center gap-4">
        <Image
          src={current.art}
          alt=""
          width={126}
          height={145}
          className="h-20 w-auto shrink-0"
        />
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-navy/50">
            Step {currentIndex + 1} of {ORDER_PHASES.length}
          </p>
          <p className="text-h4 font-bold text-navy">{current.label}</p>
          <p className="mt-1 text-small text-navy/70">{current.description}</p>
        </div>
      </div>

      {/* Timeline. The <ol> is the accessible source of truth; the rail behind
          it is decorative. */}
      <ol className="relative mt-8 grid grid-cols-4 gap-2">
        {/* rail */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-3 h-0.5 -translate-y-1/2 bg-navy/15"
        />
        <span
          aria-hidden
          className="absolute left-0 top-3 h-0.5 -translate-y-1/2 bg-navy transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />

        {ORDER_PHASES.map((phase, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={phase.id}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border-2 bg-white text-caption font-bold transition-colors",
                  done && "border-navy bg-navy text-white",
                  active && "border-navy text-navy ring-4 ring-navy/15",
                  !done && !active && "border-navy/25 text-navy/30"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-caption leading-tight",
                  active ? "font-bold text-navy" : "text-navy/50"
                )}
              >
                {phase.label}
              </span>
              {/* State for assistive tech — the ring/fill alone is visual. */}
              <span className="sr-only">
                {done ? "completed" : active ? "current step" : "not started"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
