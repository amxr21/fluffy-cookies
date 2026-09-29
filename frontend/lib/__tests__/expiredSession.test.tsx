import { act, cleanup, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dashboard", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/dashboard")>(), dashboardPost: post }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); post.mockReset(); });

const shopper = { userId: "c1", name: "Mona Ali", picture: "", role: "customer" };

describe("an expired sign-in", () => {
  it("signs the page out until the shopper signs in again", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.login(shopper));
    act(() => result.current.expireSession());
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpired).toBe(true);
    act(() => result.current.login(shopper));
    expect(result.current.user?.userId).toBe("c1");
    expect(result.current.sessionExpired).toBe(false);
  });

  it("is forgotten when the shopper signs out on purpose", async () => {
    post.mockResolvedValue({ ok: true, status: 200, data: { success: true } });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.expireSession());
    await act(() => result.current.logout());
    expect(result.current.sessionExpired).toBe(false);
  });

  it("lets a page open the navbar's sign-in dialog", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider><GoogleLoginButton />{children}</AuthProvider>,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => result.current.setSignInOpen(true));
    expect(screen.getByRole("dialog", { name: "Welcome to Fluffy" })).toBeInTheDocument();
  });
});
