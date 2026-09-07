import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

  /**
   * Proxy the API through this origin.
   *
   * The browser calls /api/v1/* on the storefront, and Next forwards to the
   * backend server-side. That keeps auth cookies same-site, so they can be
   * `SameSite=Lax` and the browser's own CSRF protection applies — the
   * alternative for a split-origin deploy is `SameSite=None` plus a
   * double-submit token layer on every mutation.
   *
   * The backend URL is read at request time and is NOT NEXT_PUBLIC_: the
   * browser no longer needs to know where the API lives, which also means the
   * API origin is not advertised in the client bundle.
   */
  async rewrites() {
    const target = (process.env.API_ORIGIN || "http://localhost:4000").replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }];
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
        ],
      },
    ];
  },
};

export default nextConfig;
