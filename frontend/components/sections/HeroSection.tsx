import Image from "next/image";

import { Container } from "@/components/ui/Container";

/** Small decorative navy label scattered around the hero. */
function FloatLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute text-2xl font-thin leading-tight text-navy/70 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* cookies bleeding in from the edges */}
      <Image
        src="/images/hero/cookie 2.png"
        alt=""
        width={320}
        height={320}
        className="pointer-events-none absolute -left-40 top-0 w-32 md:w-36 lg:w-80"
      />
      <Image
        src="/images/hero/cookie 1-1.png"
        alt=""
        width={320}
        height={320}
        className="pointer-events-none absolute -right-4 top-40 w-32 md:w-36 lg:w-40"
      />

      <Container className="relative flex min-h-[88vh] flex-col items-center justify-center py-20 text-center">
        {/* scattered labels */}
        <FloatLabel className="left-[12%] top-[24%] text-center w-24">
          every bite tells a story
        </FloatLabel>
        <FloatLabel className="right-[12%] top-[46%] text-center w-24">
          Made with Love
        </FloatLabel>

        {/* headline */}
        <p className="text-h2 font-medium text-navy -mb-6">Your favourite</p>
        <h1 className="z-50 -mb-24 text-[clamp(4rem,13vw,10rem)] font-bold leading-none text-navy">
          Cookie
        </h1>

        {/* hero cookie + yum badge */}
        <div className="hero-cookie relative mt-2">
          <Image
            src="/images/hero/cookie 1.png"
            alt="Fluffy chocolate chip cookie"
            width={620}
            height={620}
            priority
            className="relative z-[1] w-[clamp(18rem,40vw,30rem)]"
          />
          <Image
            src="/images/yum.png"
            alt="Yum!"
            width={120}
            height={120}
            className="absolute -left-14 top-1/2 z-[2] w-20 md:w-30"
          />
        </div>

        <p className="-mt-16 z-[9999] text-[clamp(3rem,8vw,6rem)] font-bold leading-none text-navy">
          Of the day!
        </p>
      </Container>
    </section>
  );
}
