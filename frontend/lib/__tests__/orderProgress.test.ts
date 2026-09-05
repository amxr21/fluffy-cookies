import { describe, expect, it } from "vitest";
import { ORDER_PHASES, getOrderProgress } from "@/lib/orders";

describe("getOrderProgress", () => {
  it("maps the backend's real status", () => {
    expect(getOrderProgress("pending")).toEqual({ currentIndex: 0, cancelled: false });
  });
  it("maps each phase id to its own index", () => {
    ORDER_PHASES.forEach((p, i) =>
      expect(getOrderProgress(p.id).currentIndex).toBe(i)
    );
  });
  it("accepts aliases and odd casing/spacing", () => {
    expect(getOrderProgress("BAKING").currentIndex).toBe(1);
    expect(getOrderProgress("ready for pickup").currentIndex).toBe(2);
    expect(getOrderProgress("out-for-delivery").currentIndex).toBe(2);
    expect(getOrderProgress("Delivered").currentIndex).toBe(3);
  });
  it("flags cancelled orders", () => {
    expect(getOrderProgress("cancelled").cancelled).toBe(true);
    expect(getOrderProgress("refunded").cancelled).toBe(true);
  });
  it("falls back to phase 1 for unknown/empty status", () => {
    expect(getOrderProgress("wat").currentIndex).toBe(0);
    expect(getOrderProgress("").currentIndex).toBe(0);
  });
});
