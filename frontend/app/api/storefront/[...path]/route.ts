import { NextRequest, NextResponse } from "next/server";

const COOKIE = "fluffy_customer_session";
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
    response.cookies.set(COOKIE, "", { httpOnly: true, path: "/api/storefront", maxAge: 0 });
    return response;
  }

  const origin = process.env.API_ORIGIN?.replace(/\/$/, "");
  if (!origin) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "Storefront API is not configured" } },
      { status: 503 }
    );
  }

  const remote = new URL(`${origin}/api/v1/public/${path}`);
  remote.search = request.nextUrl.search;
  const headers = new Headers();
  headers.set("accept", "application/json");
  const language = request.headers.get("accept-language");
  if (language) headers.set("accept-language", language);
  if (request.method !== "GET") headers.set("content-type", "application/json");
  const token = request.cookies.get(COOKIE)?.value;
  if (token && path !== "auth/google") headers.set("authorization", `Bearer ${token}`);

  try {
    const upstream = await fetch(remote, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.text(),
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
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    const response = NextResponse.json(body, { status: upstream.status });
    response.headers.set("cache-control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Storefront API is unavailable" } },
      { status: 502 }
    );
  }
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
