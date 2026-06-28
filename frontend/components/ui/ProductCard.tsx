import Image from "next/image";

import { SectionDivider } from "@/components/ui/SectionDivider";
import type { CollectionItem } from "@/lib/products";

/** Presentational card: product image, divider, name, description. */
export function ProductCard({ item }: { item: CollectionItem }) {
  return (
    <article className="group flex flex-col items-center rounded-3xl border border-navy/15 bg-white/40 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-navy/30 hover:shadow-xl hover:shadow-navy/5">
      <div className="product-depth relative flex h-48 items-center justify-center">
        <Image
          src={item.image}
          alt={item.name}
          width={240}
          height={240}
          className="relative z-10 max-h-48 w-auto object-contain transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      <SectionDivider className="my-5 w-28" />

      <h3 className="text-h4 font-bold text-navy">{item.name}</h3>
      <p className="mt-2 text-small text-navy/70">{item.description}</p>
    </article>
  );
}
