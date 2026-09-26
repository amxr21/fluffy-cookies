import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { HeroMotion } from "@/components/sections/HeroMotion";

/** Small decorative navy label scattered around the hero.
 *  Hidden below `lg` — at narrow widths the absolute positions collide with
 *  the headline and the cookie, so the labels only appear when there is
 *  genuinely empty gutter to sit in. */
function FloatLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute hidden text-2xl font-thin leading-tight text-navy/70 lg:block ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export function HeroSection() {
  return (
    <HeroMotion className="relative overflow-hidden">
      {/* cookies bleeding in from the edges — decorative, and hidden on small
          screens where they crowd the headline rather than framing it.
          `invisible` matches GSAP's autoAlpha start so there is no flash
          of the un-animated position before hydration. */}
      <Image
        data-hero="edge"
        src="/images/hero/cookie 2.png"
        alt=""
        aria-hidden
        width={320}
        height={320}
        className="pointer-events-none invisible absolute -left-40 top-0 hidden h-auto w-32 md:block md:w-36 lg:w-80"
      />
      <Image
        data-hero="edge"
        src="/images/hero/cookie 1-1.png"
        alt=""
        aria-hidden
        width={320}
        height={320}
        className="pointer-events-none invisible absolute -right-4 top-40 hidden h-auto w-32 md:block md:w-36 lg:w-40"
      />

      <Container className="relative flex min-h-[88vh] flex-col items-center justify-center py-20 text-center">
        {/* scattered labels */}
        <FloatLabel className="left-[12%] top-[24%] w-24 text-center">
          every bite tells a story
        </FloatLabel>
        <FloatLabel className="right-[12%] top-[46%] w-24 text-center">
          Made with Love
        </FloatLabel>

        {/* headline — one <h1> for the page; the decorative lines around it
            are folded in so screen readers read "Your favourite Cookie of
            the day!" as a single heading instead of three stray fragments. */}
        <h1 className="flex flex-col items-center">
          <span className="text-h2 font-medium text-navy -mb-2 sm:-mb-6">
            Your favourite
          </span>
          <span className="relative z-[1] -mb-10 text-[clamp(4rem,13vw,10rem)] font-bold leading-none text-navy sm:-mb-16 lg:-mb-24">
            Cookie
          </span>

          {/* hero cookie + yum badge */}
          <span className="hero-cookie relative mt-2 block">
            {/* outer span carries the intro fade/scale; the inner <img> carries
                the endless rotation, so the two never fight over `transform` */}
            <span data-hero="cookie" className="invisible relative z-[1] block">
              <Image
                src="/images/hero/cookie 1.png"
                alt="Fluffy chocolate chip cookie"
                width={620}
                height={620}
                priority
                sizes="(max-width: 640px) 80vw, 40vw"
                className="h-auto w-[clamp(18rem,40vw,30rem)] will-change-transform"
              />
            </span>
            <Image
              data-hero="yum"
              src="/images/yum.png"
              alt=""
              aria-hidden
              width={120}
              height={120}
              className="invisible absolute -left-6 top-1/2 z-[2] h-auto w-16 sm:-left-14 sm:w-20 md:w-30"
            />
          </span>

          <span className="-mt-8 text-[clamp(3rem,8vw,6rem)] font-bold leading-none text-navy sm:-mt-12 lg:-mt-16">
            Of the day!
          </span>
        </h1>

        {/* Primary action — the landing page previously had no way into the
            ordering flow at all. */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/menu"
            className="rounded-lg bg-navy px-7 py-3 text-small font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy/90 hover:shadow-lg hover:shadow-navy/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transform-none"
          >
            Order Now
          </Link>
          <Link
            href="/services"
            className="rounded-lg border border-navy/40 px-7 py-3 text-small font-semibold uppercase tracking-wide text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transform-none"
          >
            Book a Booth
          </Link>
        </div>
      </Container>
    </HeroMotion>
  );
}
