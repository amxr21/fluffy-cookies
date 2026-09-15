"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/Field";

/**
 * Menu search.
 *
 * The term lives in the URL, not in component state alone: a search someone
 * wants to send to a friend, bookmark, or reach with the back button has to
 * survive leaving the page. The standard asks the same of catalog filters.
 *
 * Debounced, because every keystroke would otherwise be a navigation and a
 * server round trip.
 */
export function MenuSearch({ resultCount }: { resultCount?: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [term, setTerm] = useState(initial);

  // Keep the field in step when the URL changes underneath it — a back button
  // press must not leave a stale term in the box.
  useEffect(() => {
    setTerm(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    if (term === initial) return;

    const id = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (term.trim()) next.set("q", term.trim());
      else next.delete("q");

      // `scroll: false` so the page does not jump to the top on every keystroke
      // while the reader is looking at results.
      router.replace(next.toString() ? `/menu?${next}` : "/menu", { scroll: false });
    }, 300);

    return () => clearTimeout(id);
  }, [term, initial, params, router]);

  return (
    <div className="mx-auto mb-8 max-w-md">
      <Input
        label="Search the menu"
        type="search"
        placeholder="Try “matcha” or “chocolate”"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {/* Announced politely so a screen reader hears the count change without
          the field losing focus. */}
      <p aria-live="polite" className="mt-2 min-h-5 text-caption text-navy/60">
        {term.trim() && resultCount !== undefined
          ? `${resultCount} ${resultCount === 1 ? "result" : "results"} for “${term.trim()}”`
          : ""}
      </p>
    </div>
  );
}
