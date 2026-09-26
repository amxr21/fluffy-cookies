import { API_URL } from "@/lib/config";
import { reportClientError } from "@/lib/clientLogger";

/**
 * Central fetch wrapper for all client-side API calls. Never throws — callers
 * branch on `ok`. Adds a timeout, parses JSON safely, surfaces the backend's
 * `{ error: { message, code } }` shape, sends the httpOnly auth cookies, and
 * reports unexpected (5xx/network) failures. On a 401 it refreshes the session
 * once and replays the request.
 *
 *   { ok: true,  status, data }
 *   { ok: false, status, error: { message, code }, data? }
 */

/** `requestId` is present whenever the backend answered — it is the string a
 *  customer can quote to make a failure findable in the logs. Absent on a
 *  network error or timeout, where no request ever reached the server. */
export type ApiError = { message: string; code: string; requestId?: string };

export type FetchResult<T> =
  | { ok: true; status: number; data: T; error?: undefined }
  | { ok: false; status: number; error: ApiError; data?: unknown };

type SafeFetchOptions = RequestInit & {
  timeoutMs?: number;
  baseUrl?: string;
  /** Internal: set on the replay after a refresh, so a 401 cannot loop. */
  __retried?: boolean;
};

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * A single in-flight refresh, shared by every caller.
 *
 * Without this, a page that fires four requests on mount and gets four 401s
 * would run four refreshes — and because refresh tokens rotate, three of them
 * would present an already-used token and trip reuse detection, revoking the
 * session and signing the user out. The bug looks like "randomly logged out".
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function safeFetch<T = unknown>(
  path: string,
  options: SafeFetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseUrl = API_URL,
    ...init
  } = options;

  if (!baseUrl && !path.startsWith("http")) {
    const error: ApiError = {
      message: "API base URL is not configured",
      code: "CONFIG_ERROR",
    };
    reportClientError({ source: "fetch", message: error.message, component: path });
    return { ok: false, status: 0, error };
  }

  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);

  try {
    // `credentials: "include"` sends the httpOnly auth cookies. Same-origin by
    // default (next.config.ts proxies the API), so they stay SameSite=Lax.
    const res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    // The access token is short-lived by design, so a 401 mid-session is the
    // expected path, not an error: refresh once and replay the request. Skipped
    // for the refresh call itself, which would otherwise recurse.
    if (res.status === 401 && !path.startsWith("/auth/refresh") && !options.__retried) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return safeFetch<T>(path, { ...options, __retried: true });
      }
    }

    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      // The header is set by the backend on every response; the envelope also
      // carries it. Prefer the body, fall back to the header — a proxy error
      // page or a 502 has the header but no envelope.
      //
      // Read defensively: reading the requestId is a diagnostic nicety, and it
      // must never be the reason a real 4xx is reported as a network failure.
      let headerRequestId: string | undefined;
      try {
        headerRequestId = res.headers?.get("x-request-id") ?? undefined;
      } catch {
        /* no readable headers — carry on without the id */
      }
      const maybe = body as { error?: ApiError } | null;
      const envelope =
        maybe && typeof maybe === "object" && maybe.error ? maybe.error : null;
      const error: ApiError = envelope
        ? { ...envelope, requestId: envelope.requestId ?? headerRequestId }
        : {
            message: `Request failed (${res.status})`,
            code: "HTTP_ERROR",
            requestId: headerRequestId,
          };

      if (res.status >= 500) {
        reportClientError({
          source: "fetch",
          message: `${init.method || "GET"} ${path} -> ${res.status}: ${error.message}`,
          component: path,
          requestId: error.requestId,
        });
      }
      return { ok: false, status: res.status, error, data: body };
    }

    return { ok: true, status: res.status, data: body as T };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const error: ApiError = {
      message: aborted ? "The request timed out" : "Network error — please try again",
      code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
    };
    reportClientError({
      source: "fetch",
      message: `${init.method || "GET"} ${path} failed`,
      stack: err instanceof Error ? err.stack : undefined,
      component: path,
    });
    return { ok: false, status: 0, error };
  } finally {
    clearTimeout(timer);
  }
}

const jsonHeaders = (extra?: HeadersInit) => ({
  "Content-Type": "application/json",
  ...(extra || {}),
});

export const getJSON = <T = unknown>(path: string, options?: SafeFetchOptions) =>
  safeFetch<T>(path, { ...options, method: "GET" });

export const postJSON = <T = unknown>(
  path: string,
  body: unknown,
  options?: SafeFetchOptions
) =>
  safeFetch<T>(path, {
    ...options,
    method: "POST",
    headers: jsonHeaders(options?.headers),
    body: JSON.stringify(body),
  });

export const patchJSON = <T = unknown>(
  path: string,
  body: unknown,
  options?: SafeFetchOptions
) =>
  safeFetch<T>(path, {
    ...options,
    method: "PATCH",
    headers: jsonHeaders(options?.headers),
    body: JSON.stringify(body),
  });

export const deleteJSON = <T = unknown>(
  path: string,
  body?: unknown,
  options?: SafeFetchOptions
) =>
  safeFetch<T>(path, {
    ...options,
    method: "DELETE",
    headers: jsonHeaders(options?.headers),
    body: body ? JSON.stringify(body) : undefined,
  });

/**
 * The envelope every list endpoint returns.
 *
 * `hasMore` rather than a page count: the server does not compute a second
 * full scan just to render a "Next" button that only needs to know whether
 * there is one.
 */
export type Paginated<T> = {
  data: T[];
  page: {
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
    total?: number;
  };
};
