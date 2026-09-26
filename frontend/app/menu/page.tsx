import { MenuSection, PageHeader } from "@/components/sections";
import { Container } from "@/components/ui/Container";
import { Suspense } from "react";

import { MenuSearch } from "@/components/sections/MenuSearch";
import { getMenu } from "@/lib/catalogue";

export const metadata = {
  title: "Menu",
  description:
    "Cookies, stuffed sweets and specialty drinks, baked fresh daily in Al Ain.",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Server component: the menu is fetched at build/revalidate time, so the
  // page ships as HTML rather than a spinner that fills in.
  const { q } = await searchParams;
  const { categories } = await getMenu();

  // Filtered on the server, so a shared search URL renders its results rather
  // than the whole menu followed by a flicker.
  const term = (q ?? "").trim().toLowerCase();
  const shown = term
    ? categories
        .map((c) => ({
          ...c,
          items: c.items.filter(
            (i) =>
              i.name.toLowerCase().includes(term) ||
              i.description.toLowerCase().includes(term)
          ),
        }))
        .filter((c) => c.items.length > 0)
    : categories;

  const resultCount = shown.reduce((n, c) => n + c.items.length, 0);

  return (
    <main className="flex-1">
      {/* Bounding wrapper: the sticky header releases when this scrolls out,
          so it can never overlap the footer or sections below. */}
      <div className="relative">
        <PageHeader
          sticky
          title="Our Menu"
          subtitle="Baked with Love"
          blurb="At Fluffy, we're more than just cookies and coffees — we're in the business of creating smiles. Whether you're ordering a sweet treat for yourself, planning a gathering, or surprising someone special, we've got a service for that."
        />

        <Container className="relative z-10 pb-16 md:pb-24">
          <Suspense fallback={<div className="mb-8 h-20" />}>
            <MenuSearch resultCount={term ? resultCount : undefined} />
          </Suspense>

          {term && resultCount === 0 ? (
            <div className="rounded-3xl border border-navy/15 bg-white/60 py-20 text-center backdrop-blur-md">
              <p className="text-h3 font-bold text-navy">Nothing matched “{q}”</p>
              <p className="mt-2 text-body text-navy/70">
                Try a different word, or clear the search to see everything.
              </p>
            </div>
          ) : (
          <div className="overflow-hidden rounded-3xl border border-navy/15 bg-white/60 shadow-2xl shadow-navy/10 backdrop-blur-md">
            {shown.map((category) => (
              <MenuSection key={category.id} category={category} />
            ))}
          </div>
          )}
        </Container>
      </div>
    </main>
  );
}
