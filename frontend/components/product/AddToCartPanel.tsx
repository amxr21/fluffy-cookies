"use client";

import { FiHeart } from "react-icons/fi";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { QuantityCounter } from "@/components/ui/QuantityCounter";
import { useCart } from "@/context/CartContext";
import { useLikes } from "@/context/LikeContext";
import { DEFAULT_CURRENCY } from "@/lib/money";
import type { MenuItem } from "@/lib/menu";

/**
 * The interactive part of a product page.
 *
 * Split out so the page itself stays a server component: the name, description,
 * price and image are what a search engine indexes and what the customer waits
 * for, and none of it needs JavaScript.
 */
export function AddToCartPanel({ item }: { item: MenuItem }) {
  const { addToCart } = useCart();
  const { isLiked, toggleLike } = useLikes();
  const [quantity, setQuantity] = useState(1);

  const liked = isLiked(item.productId);

  const handleAdd = () =>
    addToCart({
      id: item.id,
      productId: item.productId,
      name: item.name,
      description: item.description,
      priceMinor: item.priceMinor,
      currency: DEFAULT_CURRENCY,
      image: item.image,
      quantity,
    });

  return (
    <div className="mt-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-small text-navy/70">Quantity</span>
        <QuantityCounter value={quantity} onChange={setQuantity} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleAdd} className="flex-1">
          Add to cart
        </Button>
        <button
          type="button"
          onClick={() => toggleLike(item.productId)}
          aria-pressed={liked}
          aria-label={
            liked
              ? `Remove ${item.name} from favourites`
              : `Save ${item.name} to favourites`
          }
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-navy/20 text-navy transition-colors hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <FiHeart className={liked ? "size-5 fill-current" : "size-5"} aria-hidden />
        </button>
      </div>
    </div>
  );
}
