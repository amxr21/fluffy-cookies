import type { Metadata } from "next";
import Script from "next/script";
import { sourGummy } from "./fonts";
import { Navbar, Footer, RouteLoader } from "@/components/layout";
import { SITE_URL } from "@/lib/site";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

const DESCRIPTION =
  "Handcrafted cookies and sweet specialty coffees, freshly made every day for pickup, delivery or events. Al Ain, UAE.";

export const metadata: Metadata = {
  // metadataBase makes every relative OG/twitter image absolute. Without it a
  // shared link renders with no image at all.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fluffy — Handcrafted Cookies & Specialty Coffee",
    // Per-page titles fill the %s, so each route is distinct in a search
    // result and in a browser tab.
    template: "%s | Fluffy",
  },
  description: DESCRIPTION,
  applicationName: "Fluffy",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Fluffy",
    locale: "en_AE",
    title: "Fluffy — Handcrafted Cookies & Specialty Coffee",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/images/hero/cookie 1.png", width: 620, height: 620, alt: "A Fluffy cookie" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fluffy — Handcrafted Cookies & Specialty Coffee",
    description: DESCRIPTION,
    images: ["/images/hero/cookie 1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourGummy.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Hero art is hidden until GSAP fades it in; without JS, show it. */}
        <noscript>
          <style>{`[data-hero]{visibility:visible!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-screen flex-col pt-18 text-black font-display">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <SmoothScroll>
                <RouteLoader />
                <Navbar />
                {children}
                <Footer />
              </SmoothScroll>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
