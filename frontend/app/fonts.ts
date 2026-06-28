import localFont from "next/font/local";

// SourGummy — the Fluffy brand typeface (Normal width).
// Exposed as the CSS variable --font-sour-gummy and used app-wide.
export const sourGummy = localFont({
  src: [
    { path: "../public/fonts/SourGummy-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/SourGummy-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/SourGummy-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/SourGummy-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/SourGummy-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-sour-gummy",
  display: "swap",
});
