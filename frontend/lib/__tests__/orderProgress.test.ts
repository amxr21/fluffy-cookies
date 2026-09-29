import { describe, expect, it } from "vitest";
import { getOrderPhases, getOrderProgress } from "@/lib/orders";

describe("dashboard order progress", () => {
  it.each([
    ["PENDING", 0], ["CONFIRMED", 1], ["SHIPPED", 2],
    ["DELIVERED", 3], ["READY_FOR_PICKUP", 2], ["COLLECTED", 3],
  ])("maps %s to step %i", (status, index) => {
    expect(getOrderProgress(status)).toEqual({ currentIndex: index, cancelled: false, returned: false });
  });
  it("shows distinct terminal states", () => {
    expect(getOrderProgress("CANCELED")).toEqual({ currentIndex: -1, cancelled: true, returned: false });
    expect(getOrderProgress("RETURNED")).toEqual({ currentIndex: -1, cancelled: false, returned: true });
  });
  it("uses the correct pickup and delivery handover labels", () => {
    expect(getOrderPhases("PICKUP").map(p => p.label)).toEqual(["Order placed", "Preparing", "Ready for pickup", "Collected"]);
    expect(getOrderPhases("DELIVERY").map(p => p.label)).toEqual(["Order placed", "Preparing", "Out for delivery", "Delivered"]);
  });
});
