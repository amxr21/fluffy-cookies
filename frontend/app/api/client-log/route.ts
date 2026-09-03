import { NextResponse } from "next/server";

/**
 * Sink for `reportClientError` (lib/clientLogger.ts).
 *
 * Without this route every client-side error report 404s — and because the
 * fetch wrapper reports its own failures, one backend outage produced a pair
 * of 404s for every failed call, burying the real error in the console.
 *
 * Payloads arrive via `navigator.sendBeacon`, which cannot be authenticated
 * and is trivially forgeable, so this endpoint is deliberately minimal: it
 * logs server-side and always answers 204. It never echoes the body back.
 */

type ClientErrorReport = {
  source?: unknown;
  message?: unknown;
  stack?: unknown;
  component?: unknown;
  url?: unknown;
  ts?: unknown;
};

/** Trim to a sane length so a malicious beacon can't flood the logs. */
const str = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;

export async function POST(request: Request) {
  try {
    const raw: ClientErrorReport = await request.json();

    // Only the known fields, each length-capped — the body is untrusted input.
    const report = {
      source: str(raw.source, 64) ?? "unknown",
      message: str(raw.message, 512) ?? "(no message)",
      component: str(raw.component, 128),
      url: str(raw.url, 512),
      stack: str(raw.stack, 2048),
      ts: str(raw.ts, 40) ?? new Date().toISOString(),
    };

    console.error("[client-error]", report);
  } catch {
    // Malformed body — nothing useful to log, and the client cannot act on it.
  }

  // Always 204: the reporter is best-effort and ignores the response.
  return new NextResponse(null, { status: 204 });
}
