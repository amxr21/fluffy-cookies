import type { CartLine } from "@/lib/cart";
import { dashboardGet, dashboardPatch, type DashboardCart } from "@/lib/dashboard";

export const GUEST_CART_KEY = "fluffy_cart";
export const GUEST_TRANSFER_KEY = "fluffy_cart_transfer";
const TRANSFER_KEY = GUEST_TRANSFER_KEY;
type Transfer = { userId: string; productId: string; quantity: number; guestQuantity: number };
const pending = new Map<string, Promise<DashboardCart>>();

export function readGuestCart(storage: Pick<Storage, "getItem">): CartLine[] {
  const raw: unknown = JSON.parse(storage.getItem(GUEST_CART_KEY) ?? "[]");
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((line): line is CartLine => line && typeof line === "object"
    && typeof line.id === "string" && typeof line.productId === "string"
    && Number.isSafeInteger(line.quantity) && line.quantity > 0);
  const grouped = new Map<string, CartLine>();
  for (const line of valid) {
    const previous = grouped.get(line.productId);
    grouped.set(line.productId, { ...line, quantity: (previous?.quantity ?? 0) + line.quantity });
  }
  return [...grouped.values()];
}

/** Checkpoint each transfer before sending it, so retries after a lost response
 * set the original absolute quantity. Only acknowledged guest quantities clear. */
async function transferGuestCart(userId: string, storage: Storage, isCurrent: () => boolean): Promise<DashboardCart> {
  const initial = await dashboardGet<DashboardCart>("/cart");
  if (!initial.ok) throw new Error(initial.error.message);
  let cart = initial.data;
  const guests = readGuestCart(storage);
  const saved: Transfer | null = JSON.parse(storage.getItem(TRANSFER_KEY) ?? "null");
  if (saved && (typeof saved.userId !== "string" || typeof saved.productId !== "string"
    || !Number.isSafeInteger(saved.quantity) || saved.quantity <= 0
    || !Number.isSafeInteger(saved.guestQuantity) || saved.guestQuantity <= 0)) {
    throw new Error("Your saved guest transfer could not be read.");
  }
  // An uncertain transfer belongs to its original account. Do not copy it
  // into a different account until that account has acknowledged it.
  if (saved && saved.userId !== userId) throw new Error("Some guest items are waiting to be saved to your previous account. Sign in to that account to finish.");
  if (saved) {
    const index = guests.findIndex((line) => line.productId === saved.productId);
    if (index < 0) {
      // The guest removed this line while a write was uncertain. Resolve that
      // checkpoint before starting a different transfer.
      const acknowledged = cart.lines.some((line) => line.productId === saved.productId && line.quantity >= saved.quantity);
      if (!acknowledged) throw new Error("Your previous guest cart transfer could not be confirmed.");
      storage.removeItem(TRANSFER_KEY);
    } else {
      guests.unshift(...guests.splice(index, 1));
    }
  }
  for (const snapshot of guests) {
    if (!isCurrent()) return cart;
    // Another tab can edit guest quantities while the preceding write waits.
    const guest = readGuestCart(storage).find((line) => line.productId === snapshot.productId);
    if (!guest) continue;
    const existing = cart.lines.find((line) => line.productId === guest.productId);
    const transfer = saved?.productId === guest.productId ? {
      ...saved, quantity: saved.quantity + guest.quantity - saved.guestQuantity, guestQuantity: guest.quantity,
    } : {
      userId, productId: guest.productId, quantity: (existing?.quantity ?? 0) + guest.quantity, guestQuantity: guest.quantity,
    };
    storage.setItem(TRANSFER_KEY, JSON.stringify(transfer));
    if ((existing?.quantity ?? 0) < transfer.quantity) {
      const result = await dashboardPatch<DashboardCart>("/cart", { productId: guest.productId, quantity: transfer.quantity });
      if (!result.ok) throw new Error(result.error.message);
      cart = result.data;
      if (!cart.lines.some((line) => line.productId === guest.productId && line.quantity >= transfer.quantity)) {
        throw new Error("Your guest item could not be saved in full.");
      }
    }
    if (!isCurrent()) return cart;
    const remaining = readGuestCart(storage).flatMap((line) => {
      if (line.productId !== guest.productId) return [line];
      const quantity = line.quantity - guest.quantity;
      return quantity > 0 ? [{ ...line, quantity }] : [];
    });
    storage.setItem(GUEST_CART_KEY, JSON.stringify(remaining));
    storage.removeItem(TRANSFER_KEY);
  }
  return cart;
}

/** Reuse the in-flight operation across React effect replays. */
export function mergeGuestCart(userId: string, storage: Storage, isCurrent: () => boolean): Promise<DashboardCart> {
  const existing = pending.get(userId);
  if (existing) return existing;
  const operation = transferGuestCart(userId, storage, isCurrent).finally(() => pending.delete(userId));
  pending.set(userId, operation);
  return operation;
}
