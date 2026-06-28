import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { CONTACT } from "@/lib/site";

/** Full-width navy banner with a custom-order CTA. */
export function SpecialCTABanner() {
  return (
    <section className="bg-navy text-white">
      <Container className="py-16 text-center md:py-20">
        <h2 className="text-h2 font-bold text-white">Something Special in Mind?</h2>
        <p className="mx-auto mt-4 max-w-3xl text-body text-white/85">
          We love custom ideas! Whether it&apos;s a custom flavor, a corporate
          gift order, or a private booth setup — we&apos;d love to hear your
          vision.
          <br />
          ✉️ Contact us at{" "}
          <a href={`mailto:${CONTACT.email}`} className="underline">
            {CONTACT.email}
          </a>{" "}
          or DM us on Instagram{" "}
          <a href="#" className="underline">
            @fluffy.u.ae
          </a>
        </p>
        <Link
          href="/about"
          className="mt-8 inline-block rounded-lg border border-white/70 px-6 py-3 text-small font-semibold text-white transition-colors hover:bg-white/10"
        >
          Enlighten Us Here
        </Link>
      </Container>
    </section>
  );
}
