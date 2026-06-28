"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Direction = "up" | "down" | "left" | "right" | "fade";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Direction the element travels FROM as it enters. */
  from?: Direction;
  /** Animate each direct child in sequence instead of the wrapper as a whole. */
  stagger?: boolean;
  delay?: number;
};

/** from = where it starts, then eases to its resting position (x:0, y:0). */
const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 56 },
  down: { x: 0, y: -56 },
  left: { x: -72, y: 0 }, // enters from the left
  right: { x: 72, y: 0 }, // enters from the right
  fade: { x: 0, y: 0 },
};

export function Reveal({
  children,
  className,
  from = "up",
  stagger = false,
  delay = 0,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;

      // Respect reduced-motion: show everything, animate nothing.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(stagger ? Array.from(root.children) : root, { autoAlpha: 1 });
        return;
      }

      const targets: gsap.TweenTarget =
        stagger && root.children.length > 0
          ? (Array.from(root.children) as HTMLElement[])
          : root;

      gsap.fromTo(
        targets,
        { ...OFFSET[from], autoAlpha: 0 },
        {
          x: 0,
          y: 0,
          autoAlpha: 1,
          duration: 0.55,
          delay,
          ease: "power2.out",
          stagger: stagger ? 0.07 : 0,
          scrollTrigger: {
            trigger: root,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        }
      );
    },
    { scope: ref, dependencies: [from, stagger, delay] }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
