import Image from "next/image";

import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionDivider } from "@/components/ui/SectionDivider";

/** About page — "How It Started" origin story. */
export function AboutStory() {
  return (
    <>
      {/* navy banner strip with a cookie photo behind it */}
      <div className="relative h-40 w-full overflow-hidden md:h-56">
        <Image
          src="/images/cookies/image 14.jpg"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-navy/70" />
      </div>

      <section>
        <Container className="py-16 md:py-24">
          <Reveal className="text-center">
          {/* cookie + sparkle emoji, overlapping the banner above */}
          <p className="-mt-28 mb-10 text-5xl md:-mt-36 md:text-6xl">🍪✨</p>

          <h1 className="text-h1 uppercase text-navy">How It Started</h1>
          <SectionDivider className="mx-auto mt-6" />

          <div className="mx-auto mt-12 max-w-4xl space-y-4 text-body-lg text-navy">
            <p>
              What began as a late-night craving turned into a mission: make
              cookies that actually hit. Soft in the center, crisp on the edge,
              and full of flavor — no shortcuts, ever.
            </p>
            <p>
              Today, Fluffy is built on that same spirit: quality-first,
              made-fresh, and always crafted with care.
            </p>
          </div>

          <p className="mt-12 text-h3 font-semibold italic text-navy">
            Sweet Cravings. Real Ingredients. Pure Joy
          </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
