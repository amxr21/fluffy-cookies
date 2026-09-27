import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { dashboardBranchId, dashboardServerConfig } from "@/lib/dashboardServer";
import { SESSION_HINT_COOKIE } from "@/lib/sessionHint";

const COOKIE = "fluffy_customer_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * The shopper's address, as the proxy in front of this server saw it.
 *
 * The dashboard rate-limits per shopper, but every call it receives comes from
 * this server — without this header it limits the whole shop as one visitor
 * (the 21st order of the hour was refused for everyone). The proxy (Traefik on
 * Coolify) sets X-Real-IP and appends the peer to X-Forwarded-For; a client can
 * write anything at the START of X-Forwarded-For, so only the last entry is
 * read. Nothing is sent unless it parses as an IP.
 */
function shopperIp(request: NextRequest): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const candidate = real || forwarded;
  return candidate && isIP(candidate) ? candidate : null;
}

/** Expire the session and its readable hint together — never one without the other. */
function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE, "", { httpOnly: true, path: "/api/storefront", maxAge: 0 });
  response.cookies.set(SESSION_HINT_COOKIE, "", { path: "/", maxAge: 0 });
}
const METHODS = ["GET", "POST", "PATCH", "DELETE"];

function allowed(path: string, method: string): boolean {
  if (path === "auth/google") return method === "POST";
  if (path === "auth/logout") return method === "POST";
  if (path === "config" || path === "products" || path === "products/menu") return method === "GET";
  if (/^products\/[a-z0-9-]+$/.test(path)) return method === "GET";
  if (path === "me") return method === "GET";
  if (path === "cart") return ["GET", "POST", "PATCH", "DELETE"].includes(method);
  if (path === "wishlist") return ["GET", "POST"].includes(method);
  if (path === "orders") return ["GET", "POST"].includes(method);
  return path === "orders/track" && method === "GET";
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await context.params;
  const path = parts.join("/");
  if (!METHODS.includes(request.method) || !allowed(path, request.method)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  if (path === "auth/logout") {
    const response = NextResponse.json({ data: { success: true } });
    clearSession(response);
    return response;
  }

  const config = dashboardServerConfig();
  if (!config) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "Storefront API is not configured" } },
      { status: 503 }
    );
  }

  const remote = new URL(`${config.origin}/api/v1/public/${path}`);
  remote.search = request.nextUrl.search;

  // Catalogue reads and checkout are per branch in the dashboard. The browser
  // never picks one; the server fills it in, the same way getMenu() does.
  const isCatalogueRead = request.method === "GET" && /^products(\/|$)/.test(path);
  const isCheckout = request.method === "POST" && path === "orders";
  let requestBody = request.method === "GET" ? undefined : await request.text();
  if (isCatalogueRead || isCheckout) {
    const branchId = await dashboardBranchId(config);
    if (!branchId) {
      return NextResponse.json(
        { error: { code: "CONFIG_ERROR", message: "Store branch is not configured" } },
        { status: 503 }
      );
    }
    if (isCatalogueRead) remote.searchParams.set("branchId", branchId);
    if (isCheckout) {
      try {
        requestBody = JSON.stringify({ ...(JSON.parse(requestBody || "{}") as object), branchId });
      } catch {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid request body" } },
          { status: 400 }
        );
      }
    }
  }
  const headers = new Headers();
  headers.set("accept", "application/json");
  headers.set("x-api-key", config.apiKey);
  const language = request.headers.get("accept-language");
  if (language) headers.set("accept-language", language);
  const ip = shopperIp(request);
  if (ip) headers.set("x-storefront-client-ip", ip);
  if (request.method !== "GET") headers.set("content-type", "application/json");
  // Checkout is retry-safe only if the browser's key reaches the dashboard.
  const idempotencyKey = request.headers.get("idempotency-key");
  if (isCheckout && idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const token = request.cookies.get(COOKIE)?.value;
  if (token && path !== "auth/google") headers.set("authorization", `Bearer ${token}`);

  try {
    const upstream = await fetch(remote, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const raw = await upstream.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_UPSTREAM", message: "Invalid storefront API response" } },
        { status: 502 }
      );
    }

    if (path === "auth/google" && upstream.ok) {
      const login = body as { data?: { token?: string; customer?: unknown } };
      if (!login.data?.token || !login.data.customer) {
        return NextResponse.json(
          { error: { code: "BAD_UPSTREAM", message: "Invalid sign-in response" } },
          { status: 502 }
        );
      }
      const response = NextResponse.json({ data: { customer: login.data.customer } });
      response.cookies.set(COOKIE, login.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/storefront",
        maxAge: SESSION_MAX_AGE,
      });
      // Readable on purpose (see lib/sessionHint.ts): it lets pages skip `/me`
      // for guests. Carries no credential.
      response.cookies.set(SESSION_HINT_COOKIE, "1", {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    }

    const response = NextResponse.json(body, { status: upstream.status });
    response.headers.set("cache-control", "no-store");
    // The dashboard no longer accepts this session (expired, revoked, or the
    // customer was removed): drop it, so the pages stop acting signed in.
    if (upstream.status === 401 && token) clearSession(response);
    return response;
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Storefront API is unavailable" } },
      { status: 502 }
    );
  }
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
