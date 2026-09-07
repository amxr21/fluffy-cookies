import Link from "next/link";

import { Button } from "@/components/ui/Button";

/**
 * Shared state block for data-backed pages.
 *
 * `unauthorized` is its own variant, not a flavour of `error`: the standard
 * asks for "sign in" and "you don't have access" to be distinguishable,
 * because they need different actions from the reader. Wave 3 made the API
 * answer 403 rather than an empty list for exactly this reason.
 */
export function StatusState({
  variant,
  title,
  message,
  cta,
}: {
  variant: "loading" | "empty" | "error" | "unauthorized";
  title: string;
  message?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div
      role={variant === "error" || variant === "unauthorized" ? "alert" : undefined}
      className="flex flex-col items-center gap-4 py-20 text-center"
    >
      {variant === "loading" && (
        <span className="size-8 animate-spin rounded-full border-2 border-navy/20 border-t-navy" />
      )}
      <p className="text-h3 font-bold text-navy">{title}</p>
      {message && <p className="max-w-md text-body text-navy/70">{message}</p>}
      {cta && (
        <Link href={cta.href}>
          <Button>{cta.label}</Button>
        </Link>
      )}
    </div>
  );
}
