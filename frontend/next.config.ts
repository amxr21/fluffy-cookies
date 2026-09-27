import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * A real policy, not the default — B10.1 is explicit that a CSP with
 * `unsafe-inline` on scripts is one you can put in the README and not in the
 * threat model.
 *
 * Two honest caveats, both worth knowing rather than hiding:
 *
 * `'unsafe-inline'` is present on script-src for now. Next injects inline
 * bootstrap scripts, and removing it needs nonce plumbing through the document.
 * That is a real piece of work, not a config line, so it is tracked in
 * SECURITY.md rather than pretended away here.
 *
 * `'unsafe-eval'` is development-only — the dev bundler needs it, production
 * does not, so production does not get it.
 *
 * Every allowed host is here because something specific needs it: Google
 * Identity Services for sign-in, its avatar CDN for the account menu,
 * Cloudinary for product photos, and fonts. Adding a host means naming what
 * needs it.
 */
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com https://apis.google.com`,
  // GSI's client script injects a <link> to its own stylesheet to style the
  // rendered sign-in button; without this host the button loads unstyled.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // Cloudinary serves the product photos the dashboard stores. Remote images
  // render `unoptimized`, so the browser fetches them from that host directly.
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://res.cloudinary.com",
  "font-src 'self' data:",
  // The API is same-origin via the /api/storefront bridge, so no API host here.
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "form-action 'self'",
  // The modern equivalent of X-Frame-Options, honoured where both are read.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Upgrade any stray http:// subresource rather than blocking the page.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        // Google account avatars returned by Google Identity Services as the
        // signed-in user's `picture`. next/image refuses any remote host that
        // is not allowlisted here, and the refusal is a thrown error that takes
        // the whole page down rather than just failing the image.
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
    ],
  },

  async headers() {
    return [
      {
        // Google Identity Services signs in through a popup that calls
        // `window.postMessage` back to the opener. The browser default
        // (`same-origin-allow-popups` in Chrome) severs that link and logs
        // "Cross-Origin-Opener-Policy policy would block the window.postMessage
        // call". `unsafe-none` keeps the opener relationship intact so GSI can
        // deliver the credential.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },

          // Clickjacking: nothing here should ever be framed.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the origin cross-site, the full path same-origin. An order
          // number in a path must not leak to a third party via Referer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Deny what this app does not use, so an injected script cannot ask.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Two years, so the browser refuses plain HTTP for the whole domain.
          // Only meaningful over HTTPS; harmless in development.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
