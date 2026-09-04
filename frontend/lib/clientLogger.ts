/** Best-effort client-side error reporting. Posts to a log endpoint; never
 *  throws (so logging can't break the app). Mirrors the storefront template. */

type ClientError = {
  source: string;
  message: string;
  stack?: string;
  component?: string;
  /** Correlation id from the failed API response, when there was one. Lets a
   *  client-side report be joined to the server-side log of the same request. */
  requestId?: string;
};

const ENDPOINT =
  process.env.NEXT_PUBLIC_CLIENT_LOG_ENDPOINT || "/api/client-log";
const ENABLED =
  (process.env.NEXT_PUBLIC_CLIENT_LOGGING_ENABLED ?? "true").toLowerCase() !==
  "false";

export function reportClientError(error: ClientError): void {
  if (!ENABLED || typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      ...error,
      url: window.location.href,
      ts: new Date().toISOString(),
    });
    // sendBeacon survives page unloads; fall back to fetch.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body);
    } else {
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* logging must never throw */
  }
}
