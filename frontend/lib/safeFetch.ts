import { API_URL, AUTH_KEYS } from "@/lib/config";
import { reportClientError } from "@/lib/clientLogger";

/**
 * Central fetch wrapper for all client-side API calls. Never throws — callers
 * branch on `ok`. Adds a timeout, parses JSON safely, surfaces the backend's
 * `{ error: { message, code } }` shape, attaches the auth token, and reports
 * unexpected (5xx/network) failures. Mirrors the storefront template.
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
};

const DEFAULT_TIMEOUT_MS = 15000;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_KEYS.token);
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
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });

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
