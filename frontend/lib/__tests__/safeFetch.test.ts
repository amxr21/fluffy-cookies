import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { safeFetch } from "@/lib/safeFetch";

/**
 * `safeFetch` is the single path every client-side API call takes, so its
 * contract matters more than any individual caller's: it must NEVER throw.
 * Callers branch on `ok` and render an error state; a thrown exception would
 * instead blank the page.
 *
 * These cover the failure modes that are hard to reproduce by hand — a timeout,
 * a network drop, a non-JSON body — which is exactly why they belong in a test
 * rather than in manual QA.
 */

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  // safeFetch reads the bearer token from localStorage; jsdom gives us a real
  // one, so clear it rather than mocking the module.
  localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

/** Minimal fetch stub — only what safeFetch actually reads.
 *  `headers` mirrors the real backend, which sets x-request-id on every
 *  response; pass `null` for requestId to simulate a proxy that does not. */
function mockFetch(status: number, body: string, requestId: string | null = "req-test-1") {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(requestId ? { "x-request-id": requestId } : {}),
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

describe("safeFetch", () => {
  it("returns the parsed JSON body on success", async () => {
    mockFetch(200, JSON.stringify([1, 2, 3]));

    const res = await safeFetch<number[]>("/products", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual([1, 2, 3]);
  });

  it("surfaces the backend's error shape on a 4xx", async () => {
    mockFetch(404, JSON.stringify({ error: { message: "Product not found", code: "NOT_FOUND" } }));

    const res = await safeFetch("/public/products/nope", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.status).toBe(404);
    expect(res.error.code).toBe("NOT_FOUND");
    expect(res.error.message).toBe("Product not found");
  });

  it("synthesises an error when the body is not the expected shape", async () => {
    mockFetch(500, "<html>Bad Gateway</html>");

    const res = await safeFetch("/anything", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    // A proxy returning HTML must still produce a usable ApiError rather than
    // crashing on the JSON parse.
    expect(res.error.code).toBe("HTTP_ERROR");
  });

  it("does not throw on a network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await safeFetch("/anything", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.error.code).toBe("NETWORK_ERROR");
    expect(res.status).toBe(0);
  });

  it("reports a timeout distinctly from a network error", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(abort);

    const res = await safeFetch("/slow", { baseUrl: "http://api.test", timeoutMs: 10 });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    // Distinct on purpose: "try again" and "check your connection" are
    // different instructions to the user.
    expect(res.error.code).toBe("TIMEOUT");
  });

  it("fails clearly when no API base URL is configured", async () => {
    const res = await safeFetch("/public/products", { baseUrl: "" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.error.code).toBe("CONFIG_ERROR");
  });

  it("attaches the bearer token when one is stored", async () => {
    localStorage.setItem("fluffy_token", "token-123");
    mockFetch(200, JSON.stringify({ data: [] }));

    await safeFetch("/public/cart", { baseUrl: "http://api.test" });

    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("sends no Authorization header when signed out", async () => {
    mockFetch(200, JSON.stringify({ data: [] }));

    await safeFetch("/public/products", { baseUrl: "http://api.test" });

    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });
});

describe("requestId propagation", () => {
  it("prefers the requestId from the error envelope", async () => {
    mockFetch(
      500,
      JSON.stringify({
        error: { message: "boom", code: "INTERNAL_ERROR", requestId: "from-body" },
      }),
      "from-header"
    );

    const res = await safeFetch("/orders", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.error.requestId).toBe("from-body");
  });

  it("falls back to the x-request-id header when the body has no envelope", async () => {
    // A 502 from a proxy: the header survives, the JSON envelope does not.
    mockFetch(502, "<html>Bad Gateway</html>", "from-header");

    const res = await safeFetch("/orders", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.error.code).toBe("HTTP_ERROR");
    expect(res.error.requestId).toBe("from-header");
  });

  it("still reports the real status when no requestId is available anywhere", async () => {
    // Guards a regression: reading the header must never turn a 404 into a
    // network error just because the id is missing.
    mockFetch(404, JSON.stringify({ error: { message: "nope", code: "NOT_FOUND" } }), null);

    const res = await safeFetch("/orders/FL1", { baseUrl: "http://api.test" });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected a failure");
    expect(res.status).toBe(404);
    expect(res.error.code).toBe("NOT_FOUND");
    expect(res.error.requestId).toBeUndefined();
  });
});
