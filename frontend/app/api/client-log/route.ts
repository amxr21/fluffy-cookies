import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { readJsonObject, RequestBodyError } from "@/lib/requestBody";

/**
 * Sink for `reportClientError` (lib/clientLogger.ts).
 *
 * Without this route every client-side error report 404s — and because the
 * fetch wrapper reports its own failures, one backend outage produced a pair
 * of 404s for every failed call, burying the real error in the console.
 *
 * Payloads arrive via `navigator.sendBeacon`, which cannot be authenticated
 * and is trivially forgeable, so this endpoint is deliberately minimal: it
 * logs server-side with a bounded body and rate budget. It never echoes the body back.
 */

const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
// Local to this server process; the global budget also bounds memory/log volume
// when an attacker changes addresses. Multiple replicas each have this budget.
const budgets = new Map<string, number>();
let windowEnd = 0;
let total = 0;

function takeBudget(request: Request): boolean {
  const now = Date.now();
  if (now >= windowEnd) {
    budgets.clear();
    windowEnd = now + WINDOW_MS;
    total = 0;
  }
  const candidate = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const key = candidate && isIP(candidate) ? candidate : "unknown";
  const count = budgets.get(key) ?? 0;
  if (count >= 20 || total >= 200) return false;
  budgets.set(key, count + 1);
  total++;
  return true;
}

/** Trim to a sane length so a malicious beacon can't flood the logs. */
const str = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;

export async function POST(request: Request) {
  if (!takeBudget(request)) return new NextResponse(null, { status: 429, headers: { "retry-after": String(Math.ceil((windowEnd - Date.now()) / 1000)) } });
  try {
    const raw = await readJsonObject(request, MAX_BODY_BYTES);

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
  } catch (error) {
    if (error instanceof RequestBodyError && error.status === 413) return new NextResponse(null, { status: 413 });
    // Malformed body — nothing useful to log, and the client cannot act on it.
  }

  // The reporter is best-effort and ignores the response.
  return new NextResponse(null, { status: 204 });
}
