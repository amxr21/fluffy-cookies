import { cn } from "@/lib/utils";

/**
 * Placeholder blocks shown while a route's data loads.
 *
 * Shaped like the content that replaces them, not a spinner on a blank page:
 * the point is that nothing jumps when the real thing arrives. A spinner
 * centred in an empty viewport tells the reader nothing about what is coming
 * and guarantees a layout shift when it does.
 *
 * `aria-hidden` throughout, with the live region left to the page — a screen
 * reader should hear "loading your orders", not eleven grey rectangles.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-md bg-navy/10 motion-reduce:animate-none",
        className
      )}
    />
  );
}

/** A card-shaped placeholder, for grids of products or liked items. */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-navy/15 bg-white/40 p-2">
      <Skeleton className="aspect-4/3 w-full rounded-xl" />
      <div className="flex flex-col items-center gap-2 pt-3 pb-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="mt-2 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** A row-shaped placeholder, for order history. */
export function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-navy/15 bg-white/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-4 h-3 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

/**
 * Wraps a set of placeholders with the announcement a screen reader needs.
 * Without this the page is silent while it loads.
 */
export function SkeletonGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
