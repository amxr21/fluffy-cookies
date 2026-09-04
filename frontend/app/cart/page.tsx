"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CartItemCard } from "@/components/cart/CartItemCard";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Dropdown } from "@/components/ui/Dropdown";
import { useCart } from "@/context/CartContext";
import type { Fulfillment } from "@/lib/cart";
import { formatMinor } from "@/lib/money";

const FULFILLMENT_OPTIONS = [
  { value: "Pickup", label: "Pickup" },
  { value: "Delivery", label: "Delivery" },
];

export default function CartPage() {
  const router = useRouter();
  const { lines, subtotalMinor, setQuantity, hydrated } = useCart();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("Pickup");

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <div className="rounded-3xl border border-navy/20 bg-beige/50 p-3 md:p-4">
          {/* header */}
          <div className="relative mb-8 flex items-center justify-center">
            <h1 className="my-2 text-h2 uppercase text-navy">Your Cart</h1>
            <Dropdown
              variant="solid"
              ariaLabel="Fulfillment method"
              value={fulfillment}
              options={FULFILLMENT_OPTIONS}
              onChange={(v) => setFulfillment(v as Fulfillment)}
              wrapperClassName="absolute right-0"
            />
          </div>

          {hydrated && lines.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-h3 font-bold text-navy">Your cart is empty</p>
              <p className="max-w-md text-body text-navy/70">
                Add some treats from the menu and they&apos;ll show up here.
              </p>
              <Link href="/menu">
                <Button>Browse the Menu</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* items */}
              <div className="grid gap-5 md:grid-cols-2">
                {lines.map((line) => (
                  <CartItemCard
                    key={line.id}
                    line={line}
                    onQuantityChange={setQuantity}
                  />
                ))}
              </div>

              {/* footer */}
              <div className="mt-10 border-t border-navy/30 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="text-h2 font-bold text-navy">Total:</span>
                  <span className="ml-auto text-h2 font-bold text-navy">
                    {formatMinor(subtotalMinor)}
                  </span>
                  <Button onClick={() => router.push("/checkout")}>
                    Continue to Payments
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Container>
    </main>
  );
}
