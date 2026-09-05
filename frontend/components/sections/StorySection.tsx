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
      <Container className="-mt-8 rounded-2xl bg-beige py-16 sm:-mt-16 md:py-24 lg:-mt-96 lg:pt-80">
        <SectionDivider className="mx-auto my-14" />

        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-6">
          {/* hand-drawn food truck */}
          <Reveal from="left">
            <Image
              src="/images/truck-illustration.png"
              alt="The Fluffy food truck"
              width={720}
              height={520}
              sizes="(max-width: 768px) 90vw, 45vw"
              className="mx-auto w-full max-w-xl"
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
