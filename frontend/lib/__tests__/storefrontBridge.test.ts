// @vitest-environment node
/**
 * The same-origin bridge to the admin dashboard (app/api/storefront/[...path]).
 *
 * It is the storefront's only security boundary in dashboard mode: it holds the
 * integration key, turns the session cookie into a Bearer token, and decides
 * which dashboard routes a browser may reach at all. These tests pin that
 * contract so a refactor cannot quietly widen it.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/app/api/storefront/[...path]/route";

const ORIGIN = "http://dashboard.test";
const KEY = "adk_test_key_never_in_browser";
const COOKIE = "fluffy_customer_session";
const HANDLERS = { GET, POST, PATCH, DELETE } as const;
type Method = keyof typeof HANDLERS;

const fetchMock = vi.fn();

function upstreamJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function call(
  method: Method,
  path: string,
  init: { body?: string; headers?: Record<string, string>; query?: string } = {}
) {
  const url = `http://localhost:3000/api/storefront/${path}${init.query ?? ""}`;
  const request = new NextRequest(url, { method, headers: init.headers, body: init.body });
  return HANDLERS[method](request, { params: Promise.resolve({ path: path.split("/") }) });
}

/** The single upstream request the bridge made (asserts there was exactly one). */
function upstreamCall() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
  return { url: new URL(url), init, headers: init.headers };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(upstreamJson({ data: { ok: true } }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_ORIGIN", ORIGIN);
  vi.stubEnv("DASHBOARD_API_KEY", KEY);
  vi.stubEnv("DASHBOARD_BRANCH_ID", "branch_main");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("allowlist", () => {
  it.each<[Method, string]>([
    ["GET", "orders/abc/status"],
    ["PATCH", "orders/abc/status"],
    ["GET", "staff"],
    ["GET", "settings"],
    ["GET", "r/customers"],
    ["GET", "auth/me/api-keys"],
    ["POST", "auth/me/api-keys"],
    ["GET", "auth/google"],
    ["GET", "branches"],
    ["GET", "categories"],
    ["GET", "discounts"],
    ["POST", "config"],
    ["POST", "products/menu"],
    ["DELETE", "orders"],
    ["PATCH", "orders"],
    ["DELETE", "wishlist"],
    ["PATCH", "wishlist"],
    ["DELETE", "me"],
    ["GET", "products/UPPER"],
    ["GET", "products/a/b"],
    ["GET", "products/../../settings"],
    ["GET", "orders/track/extra"],
  ])("%s %s → 404 and never reaches the dashboard", async (method, path) => {
    const response = await call(method, path, method === "GET" ? {} : { body: "{}" });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each<[Method, string]>([
    ["GET", "config"],
    ["GET", "products"],
    ["GET", "products/menu"],
    ["GET", "products/classic-chocolate-chip"],
    ["GET", "me"],
    ["GET", "cart"],
    ["POST", "cart"],
    ["PATCH", "cart"],
    ["DELETE", "cart"],
    ["GET", "wishlist"],
    ["POST", "wishlist"],
    ["GET", "orders"],
    ["POST", "orders"],
    ["GET", "orders/track"],
  ])("%s %s is forwarded to /api/v1/public/<path>", async (method, path) => {
    await call(method, path, method === "GET" ? {} : { body: "{}" });
    expect(upstreamCall().url.pathname).toBe(`/api/v1/public/${path}`);
  });
});

describe("credentials", () => {
  it("attaches the integration key upstream and never returns it", async () => {
    const response = await call("GET", "config");
    const { headers } = upstreamCall();
    expect(headers.get("x-api-key")).toBe(KEY);
    const echoed = JSON.stringify([...response.headers]) + (await response.text());
    expect(echoed).not.toContain(KEY);
  });

  it("turns the session cookie into a Bearer token and forwards no cookies", async () => {
    await call("GET", "cart", { headers: { cookie: `${COOKIE}=customer.jwt; other=1` } });
    const { headers } = upstreamCall();
    expect(headers.get("authorization")).toBe("Bearer customer.jwt");
    expect(headers.get("cookie")).toBeNull();
  });

  it("does not forward an existing session on sign-in", async () => {
    fetchMock.mockResolvedValue(upstreamJson({ data: { token: "new.jwt", customer: { id: "c1" } } }));
    await call("POST", "auth/google", { body: '{"idToken":"google-id-token"}', headers: { cookie: `${COOKIE}=old.jwt` } });
    expect(upstreamCall().headers.get("authorization")).toBeNull();
  });

  it("stores the dashboard token in a scoped HttpOnly cookie, not in the body", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValue(upstreamJson({ data: { token: "new.jwt", customer: { id: "c1", name: "A" } } }));
    const response = await call("POST", "auth/google", { body: '{"idToken":"google-id-token"}' });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE}=new.jwt`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\/api\/storefront/i);
    expect(await response.json()).toEqual({ data: { customer: { id: "c1", name: "A" } } });
  });

  it("rejects a sign-in response without a token as a bad upstream", async () => {
    fetchMock.mockResolvedValue(upstreamJson({ data: { customer: { id: "c1" } } }));
    const response = await call("POST", "auth/google", { body: '{"idToken":"google-id-token"}' });
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("logs out locally by expiring the cookie, without calling the dashboard", async () => {
    const response = await call("POST", "auth/logout");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${COOKIE}=;.*Max-Age=0`, "i"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("branch is chosen by the server, never the browser", () => {
  it("overrides every branchId in a catalogue query", async () => {
    await call("GET", "products/menu", { query: "?branchId=evil&branchId=evil2&q=cookie" });
    const { url } = upstreamCall();
    expect(url.searchParams.getAll("branchId")).toEqual(["branch_main"]);
    expect(url.searchParams.get("q")).toBe("cookie");
  });

  it("overwrites branchId in the checkout body", async () => {
    await call("POST", "orders", { body: JSON.stringify({ branchId: "evil", items: [] }) });
    expect(JSON.parse(String(upstreamCall().init.body))).toEqual({ branchId: "branch_main", items: [] });
  });

  it("uses the dashboard's only selling branch when none is configured", async () => {
    vi.stubEnv("DASHBOARD_BRANCH_ID", "");
    fetchMock
      .mockResolvedValueOnce(upstreamJson({ data: [{ id: "only_branch" }] }))
      .mockResolvedValueOnce(upstreamJson({ data: [] }));
    await call("GET", "products/menu");
    const [url] = fetchMock.mock.calls[1] as [URL];
    expect(new URL(url).searchParams.get("branchId")).toBe("only_branch");
  });

  it("refuses to guess between several branches", async () => {
    vi.stubEnv("DASHBOARD_BRANCH_ID", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(upstreamJson({ data: [{ id: "a" }, { id: "b" }] }));
    const response = await call("GET", "products/menu");
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("checkout retry safety", () => {
  it("forwards the browser's Idempotency-Key on checkout", async () => {
    await call("POST", "orders", { body: "{}", headers: { "idempotency-key": "key-1" } });
    expect(upstreamCall().headers.get("idempotency-key")).toBe("key-1");
  });

  it("does not forward it on other writes", async () => {
    await call("POST", "cart", { body: "{}", headers: { "idempotency-key": "key-1" } });
    expect(upstreamCall().headers.get("idempotency-key")).toBeNull();
  });

  it("rejects an unparseable checkout body before calling the dashboard", async () => {
    const response = await call("POST", "orders", { body: "{not json" });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("answers 503 when the dashboard is not configured", async () => {
    vi.stubEnv("DASHBOARD_API_KEY", "");
    const response = await call("GET", "config");
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a non-JSON upstream page to 502 BAD_UPSTREAM", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const response = await call("GET", "config");
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("BAD_UPSTREAM");
  });

  it("maps a network failure or timeout to 502 UPSTREAM_UNAVAILABLE", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));
    const response = await call("GET", "config");
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("gives up on a slow dashboard with a timeout signal", async () => {
    await call("GET", "config");
    expect(upstreamCall().init.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes the dashboard's status and error through, uncached, without its headers", async () => {
    fetchMock.mockResolvedValue(
      upstreamJson({ error: { code: "CONFLICT", message: "Sold out" } }, 409, { "set-cookie": "upstream=1", "x-internal": "1" })
    );
    const response = await call("POST", "orders", { body: "{}" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "CONFLICT", message: "Sold out" } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-internal")).toBeNull();
  });
});

describe("shopper identity for the dashboard's per-shopper rate limits", () => {
  it("forwards the proxy's X-Real-IP as X-Storefront-Client-IP", async () => {
    await call("GET", "config", { headers: { "x-real-ip": "203.0.113.7" } });
    expect(upstreamCall().headers.get("x-storefront-client-ip")).toBe("203.0.113.7");
  });

  it("falls back to the LAST X-Forwarded-For entry — the one the proxy appended", async () => {
    await call("GET", "config", { headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.4" } });
    expect(upstreamCall().headers.get("x-storefront-client-ip")).toBe("198.51.100.4");
  });

  it("accepts IPv6", async () => {
    await call("GET", "config", { headers: { "x-real-ip": "2001:db8::1" } });
    expect(upstreamCall().headers.get("x-storefront-client-ip")).toBe("2001:db8::1");
  });

  it("sends nothing when there is no usable address", async () => {
    await call("GET", "config", { headers: { "x-real-ip": "not-an-ip; drop table" } });
    expect(upstreamCall().headers.get("x-storefront-client-ip")).toBeNull();
    fetchMock.mockClear();
    await call("GET", "config");
    expect(upstreamCall().headers.get("x-storefront-client-ip")).toBeNull();
  });
});

describe("the readable signed-in hint", () => {
  const cookies = (response: Response) => response.headers.getSetCookie();

  it("is set on sign-in, readable by page script, and site-wide", async () => {
    fetchMock.mockResolvedValue(upstreamJson({ data: { token: "new.jwt", customer: { id: "c1" } } }));
    const response = await call("POST", "auth/google", { body: '{"idToken":"google-id-token"}' });
    const hint = cookies(response).find((c) => c.startsWith("fluffy_signed_in="));
    expect(hint).toMatch(/^fluffy_signed_in=1;/);
    expect(hint).toMatch(/Path=\/(;|$)/);
    expect(hint).not.toMatch(/HttpOnly/i);
    // …and it is only a hint: the credential stays in the httpOnly cookie.
    expect(hint).not.toContain("new.jwt");
  });

  it("is cleared with the session on sign-out", async () => {
    const response = await call("POST", "auth/logout");
    const set = cookies(response);
    expect(set.some((c) => /^fluffy_customer_session=;.*Max-Age=0/i.test(c))).toBe(true);
    expect(set.some((c) => /^fluffy_signed_in=;.*Max-Age=0/i.test(c))).toBe(true);
  });

  it("is cleared with the session when the dashboard rejects it", async () => {
    fetchMock.mockResolvedValue(upstreamJson({ error: { code: "UNAUTHORIZED" } }, 401));
    const response = await call("GET", "me", { headers: { cookie: `${COOKIE}=expired.jwt` } });
    expect(response.status).toBe(401);
    const set = cookies(response);
    expect(set.some((c) => /^fluffy_customer_session=;/.test(c))).toBe(true);
    expect(set.some((c) => /^fluffy_signed_in=;/.test(c))).toBe(true);
  });

  it("leaves a guest's cookies alone on a 401", async () => {
    fetchMock.mockResolvedValue(upstreamJson({ error: { code: "UNAUTHORIZED" } }, 401));
    const response = await call("GET", "me");
    expect(cookies(response)).toEqual([]);
  });
});
