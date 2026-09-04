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
