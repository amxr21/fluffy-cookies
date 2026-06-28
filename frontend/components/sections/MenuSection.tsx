import { MenuCard } from "@/components/ui/MenuCard";
import { Reveal } from "@/components/ui/Reveal";
import type { MenuCategory } from "@/lib/menu";

/** One menu category: centered title + subtitle, then a grid of cards.
 *  Rendered inside the Menu page's rounded card, so it uses inner padding
 *  rather than the full-width Container. */
export function MenuSection({ category }: { category: MenuCategory }) {
  return (
    <section className="px-6 py-12 md:px-12 md:py-16">
      <div>
        <Reveal className="flex flex-col items-center text-center">
          <span className="mb-3 rounded-full bg-beige px-5 py-1.5 text-small font-semibold uppercase tracking-wide text-brown">
            {category.title}
          </span>
          <h2 className="text-h2 font-bold uppercase text-navy">
            {category.title}
          </h2>
          <p className="mx-auto mt-2 max-w-3xl text-body italic text-navy/70">
            {category.subtitle}
          </p>
        </Reveal>

        <Reveal
          stagger
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {category.items.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
