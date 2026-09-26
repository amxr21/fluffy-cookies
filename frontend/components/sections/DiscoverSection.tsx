import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/ui/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { COLLECTION } from "@/lib/products";
import { DASHBOARD_MODE } from "@/lib/config";
import { getMenu } from "@/lib/catalogue";

export async function DiscoverSection() {
  const featured = DASHBOARD_MODE
    ? (await getMenu()).categories.flatMap((category) => category.items).slice(0, 4).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image,
        href: `/menu/${item.id}`,
      }))
    : COLLECTION;
  return (
    <section>
      <Container className="py-16 md:px-32 md:py-24">
        {/* heading row */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-h2 font-bold text-navy">Discover the Collection</h2>
            <p className="mt-2 max-w-2xl text-body text-navy/70">
              At Fluffy, we bake more than just cookies — we bake dreams. What started in a small kitchen
            </p>
          </div>

          {/* explore more — soft-rounded per brand rule.
              Carries a visible label so it is not an unnamed icon link. */}
          <Link
            href="/menu"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl border border-navy/30 px-5 py-3 text-small text-navy transition-colors hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            View full menu
            <FiArrowRight aria-hidden className="text-lg" />
          </Link>
        </div>

        {/* cards */}
        <Reveal
          stagger
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {featured.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
