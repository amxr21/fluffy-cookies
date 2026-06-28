import { cn } from "@/lib/utils";

/** Short navy rule used between sections / under headings (as in the comps). */
export function SectionDivider({ className }: { className?: string }) {
  return <span className={cn("block h-px w-56 bg-navy/40", className)} aria-hidden />;
}
