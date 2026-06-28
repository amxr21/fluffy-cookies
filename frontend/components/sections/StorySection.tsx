import Image from "next/image";

import { Container } from "@/components/ui/Container";
import { SectionDivider } from "@/components/ui/SectionDivider";

export function StorySection() {
  return (
    <section className="px-16">
      <Container className="py-16 md:py-24 md:pt-80 rounded-2xl -mt-96 bg-beige">
        <SectionDivider className="mx-auto my-14" />

        <div className="flex items-center justify-start -mx-32 gap-10 md:grid-cols-2 md:gap-6">
          {/* hand-drawn food truck */}
          <Image
            src="/images/truck-illustration.png"
            alt="The Fluffy food truck"
            width={720}
            height={520}
            className="w-full max-w-xl justify-self-center"
          />

          {/* copy */}
          <div className="space-y-8 px-10">
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
          </div>
        </div>
      </Container>
    </section>
  );
}
