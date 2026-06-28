"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useCart } from "@/context/CartContext";
import { NAV_LINKS, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { count } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-4 top-4 mx-auto rounded-2xl border border-navy/10 bg-white/70 shadow-lg shadow-navy/5 backdrop-blur-md md:inset-x-16 md:top-6 z-99999999">
      <nav className="flex items-center justify-between px-16 py-3">
        {/* Brand */}
        <Link href="/" aria-label={`${SITE.name} — home`} className="shrink-0">
          <Image
            src="/icons/logo.svg"
            alt={SITE.name}
            width={111}
            height={40}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {/* Links + cart — one group, pushed to the right */}
        <div className="flex items-center gap-8">
          {/* Links */}
          <ul className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "nav-link text-body font-medium text-navy/80",
                    isActive(link.href) && "is-active text-navy"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Cart */}
          <Link
            href="/cart"
            aria-label={`View cart${count ? `, ${count} items` : ""}`}
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl p-2.5 ring-1 ring-navy/30 transition-colors hover:bg-navy/5"
          >
            <Image src="/icons/cart.svg" alt="" width={18} height={20} className="h-full w-auto" />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-navy px-1 text-[0.65rem] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          {/* Account */}
          <GoogleLoginButton />
        </div>
      </nav>
    </header>
  );
}
