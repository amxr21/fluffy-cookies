// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/client-log", { method: "POST", body, headers });
}

describe("client log sink", () => {
  it("limits report fields and discards unknown data", async () => {
    const { POST } = await import("@/app/api/client-log/route");
    expect((await POST(request(JSON.stringify({ message: "m".repeat(600), secret: "private" })))).status).toBe(204);
    expect(console.error).toHaveBeenCalledWith("[client-error]", expect.objectContaining({ message: "m".repeat(512) }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
  });

  it.each(["null", "[]", "{broken"])("ignores malformed/non-object payload %s", async (body) => {
    const { POST } = await import("@/app/api/client-log/route");
    expect((await POST(request(body))).status).toBe(204);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rejects oversized stream without trusting Content-Length", async () => {
    const { POST } = await import("@/app/api/client-log/route");
    expect((await POST(request(JSON.stringify({ message: "x".repeat(8192) })))).status).toBe(413);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rate limits one address and resets after a minute", async () => {
    vi.useFakeTimers();
    try {
      const { POST } = await import("@/app/api/client-log/route");
      for (let i = 0; i < 20; i++) expect((await POST(request("{}", { "x-real-ip": "203.0.113.1" }))).status).toBe(204);
      const limited = await POST(request("{}", { "x-real-ip": "203.0.113.1" }));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("60");
      expect((await POST(request("{}", { "x-real-ip": "203.0.113.2" }))).status).toBe(204);
      vi.advanceTimersByTime(60_000);
      expect((await POST(request("{}", { "x-real-ip": "203.0.113.1" }))).status).toBe(204);
    } finally { vi.useRealTimers(); }
  });

  it("bounds logs even when addresses rotate", async () => {
    const { POST } = await import("@/app/api/client-log/route");
    for (let i = 1; i <= 200; i++) expect((await POST(request("{}", { "x-real-ip": `203.0.113.${i}` }))).status).toBe(204);
    expect((await POST(request("{}", { "x-real-ip": "203.0.113.201" }))).status).toBe(429);
    expect(console.error).toHaveBeenCalledTimes(200);
  });
});
