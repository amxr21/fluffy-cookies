"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Intro choreography for the hero artwork.
 *
 * Wraps the hero's markup and animates it by `data-hero` hook, so the section
 * itself stays a server component and only this thin client wrapper ships JS.
 *
 * Timing intent:
 *  - centre cookie fades + scales in, then rotates forever, slowly;
 *  - the two edge cookies drift in from their own sides alongside it;
 *  - the "Yum!" badge stamps in almost instantly at the end.
 */
export function HeroMotion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const cookie = "[data-hero='cookie']";
      const edge = "[data-hero='edge']";
      const yum = "[data-hero='yum']";

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // Final composition, no motion.
        gsap.set([cookie, edge, yum], {
          autoAlpha: 1,
          scale: 1,
          rotate: 0,
          x: 0,
          y: 0,
        });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1. centre cookie settles in
      tl.fromTo(cookie, { autoAlpha: 0, scale: 0.82 }, { autoAlpha: 1, scale: 1, duration: 0.9 })
        // 2. edge cookies drift in from their respective sides
        .fromTo(
          edge,
          { autoAlpha: 0, x: (i: number) => (i === 0 ? -60 : 60), y: 24 },
          { autoAlpha: 1, x: 0, y: 0, duration: 1.1, stagger: 0.12 },
          "-=0.65"
        )
        // 3. "Yum!" stamps in almost instantly
        .fromTo(
          yum,
          { autoAlpha: 0, scale: 0.4, rotate: -12 },
          { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.18, ease: "back.out(3)" },
          "-=0.15"
        );

      // Continuous slow spin on the inner <img>, kept off the timeline so the
      // intro's scale/fade never competes with it for the same properties.
      gsap.to(`${cookie} img`, {
        rotate: 360,
        duration: 48,
        repeat: -1,
        ease: "none",
      });
    },
    { scope }
  );

  return (
    <section ref={scope} className={className}>
      {children}
    </section>
  );
}
