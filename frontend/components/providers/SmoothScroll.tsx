"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scrolling, synced to GSAP ScrollTrigger so scroll-driven
 *  animations stay in lockstep with the eased scroll position. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      // lerp gives a responsive, even glide (less floaty than a long duration)
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Keep Lenis + ScrollTrigger in sync with the true content height — but
    // DEBOUNCED. Refreshing on every body size tick (image loads, reveals)
    // recalculates triggers mid-scroll and causes stutter.
    let debounce: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        lenis.resize();
        ScrollTrigger.refresh();
      }, 200);
    };
    const initial = setTimeout(sync, 300);
    window.addEventListener("load", sync);
    window.addEventListener("resize", sync);

    return () => {
      clearTimeout(initial);
      clearTimeout(debounce);
      window.removeEventListener("load", sync);
      window.removeEventListener("resize", sync);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
