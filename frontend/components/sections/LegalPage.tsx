import type { Metadata } from "next";

import { Container } from "@/components/ui/Container";

/**
 * Shared shell for policy pages.
 *
 * These are read to answer one question ("can I get a refund?"), not read
 * through, so the constraints are a narrow measure, real headings to scan, and
 * a visible last-updated date — a policy with no date is one a customer cannot
 * tell is current.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-h2 uppercase text-navy">{title}</h1>
          <p className="mt-2 text-caption text-navy/60">Last updated {updated}</p>

          {intro && <p className="mt-6 text-body-lg text-navy/80">{intro}</p>}

          <div className="legal-body mt-8 space-y-6 text-body text-navy/80">
            {children}
          </div>
        </article>
      </Container>
    </main>
  );
}

/** A titled block, so every policy renders its sections identically. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-h4 font-bold text-navy">{heading}</h2>
      {children}
    </section>
  );
}

/** Build the page metadata for a policy route. */
export const legalMetadata = (title: string, description: string): Metadata => ({
  title: `${title} — Fluffy`,
  description,
});
