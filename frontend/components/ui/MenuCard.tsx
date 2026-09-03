"use client";

import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/lib/menu";

/** Menu item card: photo, name, description, full-width order button. */
export function MenuCard({ item }: { item: MenuItem }) {
  const { addToCart } = useCart();

  const handleOrder = () =>
    addToCart({
      id: item.id,
      productId: item.productId,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
    });

  return (
    <article className="group flex flex-col rounded-2xl border border-navy/15 bg-white/40 p-2 transition-all duration-300 hover:-translate-y-1 hover:border-navy/30 hover:shadow-xl hover:shadow-navy/5">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col pt-1 text-center">
        <h3 className="text-h3 font-semibold text-navy">{item.name}</h3>
        <p className="mt-1 flex-1 text-caption italic text-navy/60">{item.description}</p>

        <Button fullWidth onClick={handleOrder} className="mt-4">
          Order for Pickup/ Delivery
        </Button>
      </div>
    </article>
  );
}
