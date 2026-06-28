import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { OrderReference } from "@/components/order/OrderReference";

export default function OrderSuccessPage() {
  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <div className="rounded-3xl border border-navy/20 bg-beige/30 px-6 py-16 text-center md:px-10">
          <Image
            src="/icons/bag.svg"
            alt=""
            width={158}
            height={175}
            className="mx-auto h-28 w-auto"
          />

          <h1 className="mt-8 text-h1 text-navy">Thanks for choosing Fluffy</h1>
          <p className="mt-2 text-h3 text-navy/80">
            Your order will be ready for pickup soon.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-body-lg text-navy/80">
            We&apos;re preparing your treats fresh — just the way you love them.
            You&apos;ll receive a notification once everything is ready.
          </p>

          <SectionDivider className="mx-auto my-10" />

          <Suspense
            fallback={<p className="text-body text-navy/60">Loading order…</p>}
          >
            <OrderReference />
          </Suspense>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/track-order">
              <Button variant="outline">Track this order</Button>
            </Link>
            <Link href="/menu">
              <Button>Order more</Button>
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
