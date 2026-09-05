import Image from "next/image";

import { Container } from "@/components/ui/Container";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Reveal } from "@/components/ui/Reveal";

export function StorySection() {
  return (
    <section className="px-4 sm:px-8 lg:px-16">
      {/* The card tucks up under the hero, but only once there is enough
          viewport for the overlap to read as design rather than collision —
          below `lg` it simply follows the hero. */}
      {/* overflow-hidden so the bled illustration is clipped by the card's own
          rounded corner rather than spilling past it into the page gutter. */}
      <Container className="-mt-8 overflow-hidden rounded-2xl bg-beige py-16 sm:-mt-16 md:py-24 lg:-mt-96 lg:pt-80">
        <SectionDivider className="mx-auto my-14" />

        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-6">
          {/* Hand-drawn food truck, bled flush to the container edge.
              The illustration carries detail at its extremities (wheels, the
              trailing edge, the palm frond) — inset it with padding or a
              centring margin and the card's rounded corner clips those, so it
              reads as a badly cropped photo instead of a deliberate bleed.

              The pull cancels Container's own gutter (px-6, md:px-32) so the
              art meets the edge exactly, and is applied per-breakpoint rather
              than as one fixed -mx-32: at narrow widths a fixed 8rem pull
              overflows the viewport and forces horizontal scroll. */}
          <Reveal from="left" className="-ms-6 md:-ms-32">
            <Image
              src="/images/truck-illustration.png"
              alt="The Fluffy food truck"
              width={720}
              height={520}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="w-full max-w-xl"
            />
          </Reveal>

          {/* copy */}
          <Reveal from="right" className="space-y-8 md:px-10">
            <p className="text-body-lg text-navy">
              At Fluffy, we bake more than just cookies — we bake dreams. What
              started in a small kitchen is now a brand with global vision. Our
              secret ingredient isn&apos;t just butter or chocolate chips — it&apos;s
              love and ambition. Every cookie we make carries the warmth of home
              and the drive to share it with the world.
            </p>
            <p className="text-h2 font-semibold text-navy">
              Because at Fluffy, love is always baked in.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
