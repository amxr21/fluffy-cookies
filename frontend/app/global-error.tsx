"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/clientLogger";

/**
 * Last-resort boundary, for a failure in the root layout itself.
 *
 * This replaces the whole document, so it must render its own <html> and
 * <body> — the layout that would normally provide them is what failed.
 *
 * For the same reason it uses no shared components, no fonts and no Tailwind
 * classes that depend on the theme being loaded: whatever broke may be exactly
 * that. Inline styles here are deliberate, not laziness.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      source: "global-error",
      message: error.message,
      stack: error.stack,
      component: error.digest ? `digest:${error.digest}` : "root-layout",
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fefaf0",
          color: "#090d1b",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ color: "#2f468e", fontSize: "1.75rem", margin: "0 0 0.75rem" }}>
            Fluffy is having a moment
          </h1>
          <p style={{ lineHeight: 1.6, color: "#5d3f28" }}>
            Something went wrong loading the page. Please try again.
          </p>

          {error.digest && (
            <p style={{ fontSize: "0.8rem", color: "#8a8172", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#2f468e",
              color: "#fff",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
