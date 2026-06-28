"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Full-screen page-transition loader. Shows the Kirby silhouette filling
 * from beige to navy whenever the route changes, so navigation always gives
 * clear, intuitive feedback that something is happening.
 *
 * It listens for clicks on internal links (to show instantly on click) and
 * hides once the new pathname has committed.
 */
export function RouteLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show as soon as an internal link is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      const target = link.getAttribute("target");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target === "_blank" ||
        e.metaKey ||
        e.ctrlKey
      ) {
        return;
      }
      // same-page link → no transition
      if (href === pathname) return;
      setVisible(true);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  // Hide once the new route has rendered.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 450);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden={!visible}
      role="status"
      className={`fixed inset-0 z-[999999] grid place-items-center bg-white/80 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="kirby-loader" />
        <span className="text-small font-semibold tracking-wide text-navy">
          Loading…
        </span>
      </div>
    </div>
  );
}
