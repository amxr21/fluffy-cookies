import type { Metadata } from "next";
import Script from "next/script";
import { sourGummy } from "./fonts";
import { Navbar, Footer, RouteLoader } from "@/components/layout";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluffy — Handcrafted Cookies & Specialty Coffee",
  description:
    "Fluffy: handcrafted cookies and sweet specialty coffees, freshly made every day for pickup or events. Al Ain, UAE.",
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
