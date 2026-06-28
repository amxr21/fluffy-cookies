import Link from "next/link";

import { Button } from "@/components/ui/Button";

/** Shared loading / empty / error block for data-backed pages. */
export function StatusState({
  variant,
  title,
  message,
  cta,
}: {
  variant: "loading" | "empty" | "error";
  title: string;
  message?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
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
