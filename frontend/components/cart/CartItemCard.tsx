import Image from "next/image";

import { QuantityCounter } from "@/components/ui/QuantityCounter";
import type { CartLine } from "@/lib/cart";

export function CartItemCard({
  line,
  onQuantityChange,
}: {
  line: CartLine;
  onQuantityChange: (id: string, quantity: number) => void;
}) {
  return (
    <article className="flex gap-5 rounded-2xl border border-navy/15 bg-white/40 p-2 h-60">
      <div className="relative  w-6/12 shrink-0 overflow-hidden rounded-xl max-h-56">
        <Image src={line.image} alt={line.name} fill className="object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 wrap-break-word pb-1 text-h3 font-bold leading-[1.25] text-navy">
          {line.name}
        </h3>
        <p className="mt-1 text-small text-navy/60 leading-5">{line.description}</p>


        <div className=" w-full items-start gap-6">
          <div className="mt-3">
            <QuantityCounter
              ariaLabel={`Quantity for ${line.name}`}
              value={line.quantity}
              onChange={(q) => onQuantityChange(line.id, q)}
            />
          </div>
          <div className="mt-auto pt-3">
            <p className="text-h3 font-bold text-navy leading-8">
              AED {(line.price * line.quantity).toFixed(0)}
            </p>
            <p className="text-caption text-navy/50">VAT included</p>
          </div>



        </div>
      </div>
    </article>
  );
}
