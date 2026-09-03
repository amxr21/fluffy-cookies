import Image from "next/image";
import Link from "next/link";

import { SectionDivider } from "@/components/ui/SectionDivider";
import type { CollectionItem } from "@/lib/products";

/** Presentational card: product image, divider, name, description.
 *  The card hover-lifts, so it is a real link to the menu rather than a
 *  decoration that only looks clickable. */
export function ProductCard({ item }: { item: CollectionItem }) {
  return (
    <article className="group h-full">
      <Link
        href="/menu"
        className="flex h-full flex-col items-center rounded-3xl border border-navy/15 bg-white/40 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-navy/30 hover:shadow-xl hover:shadow-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transform-none"
      >
        <div className="product-depth relative flex h-48 items-center justify-center">
          <Image
            src={item.image}
            alt={item.name}
            width={240}
            height={240}
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 22vw"
            className="relative z-10 max-h-48 w-auto object-contain transition-transform duration-500 group-hover:scale-110 motion-reduce:transform-none"
          />
        </div>

        <SectionDivider className="my-5 w-28" />

        <h3 className="text-h4 font-bold text-navy">{item.name}</h3>
        <p className="mt-2 text-small text-navy/70">{item.description}</p>
      </Link>
    </article>
  );
}
