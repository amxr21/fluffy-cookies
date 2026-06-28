import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/ui/ProductCard";
import { COLLECTION } from "@/lib/products";

export function DiscoverSection() {
  return (
    <section>
      <Container className="py-16 md:py-24 md:px-32">
        {/* heading row */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-h2 font-bold text-navy">Discover the Collection</h2>
            <p className="mt-2 max-w-2xl text-body text-navy/70">
              At Fluffy, we bake more than just cookies — we bake dreams. What started in a small kitchen
            </p>
          </div>

          {/* explore more — soft-rounded per brand rule */}
          <Link
            href="/menu"
            className="grid size-20 shrink-0 place-items-center rounded-2xl border border-navy/30 text-center text-caption text-navy transition-colors hover:bg-navy/5"
          >
            <span className="flex flex-col items-center leading-tight">
              <FiArrowRight className="mt-1 text-lg" />
            </span>
          </Link>
        </div>

        {/* cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTION.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}
