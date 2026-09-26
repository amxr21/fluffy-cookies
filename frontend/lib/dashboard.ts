import { DASHBOARD_API_URL } from "@/lib/config";
import type { CartLine } from "@/lib/cart";
import type { MenuCategory, MenuItem } from "@/lib/menu";
import type { Order } from "@/lib/orders";
import { getJSON, postJSON, patchJSON, deleteJSON, type FetchResult } from "@/lib/safeFetch";

/** Public contract in admin-dashboard/backend/src/services/storefront.service.ts. */
export type DashboardProduct = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  stock: number;
  inStock: boolean;
  category: { id: string; name: string; slug: string | null } | null;
};

export type DashboardMenuCategory = {
  id: string;
  title: string;
  slug: string | null;
  items: DashboardProduct[];
};

export type DashboardCart = {
  lines: {
    id: string;
    productId: string;
    slug: string | null;
    name: string;
    image: string | null;
    price: string;
    quantity: number;
    inStock: boolean;
  }[];
  subtotal: string;
};

export type DashboardOrder = {
  orderNumber: string;
  status: string;
  total: string;
  placedAt: string;
  items: { name: string; quantity: number; price: string }[];
};

export type DashboardCustomer = {
  id: string;
  name: string;
  email: string;
  picture: string | null;
};

/** Parse the dashboard's fixed-two decimal string without floating-point money. */
export function decimalToMinor(value: string): number {
  if (!/^\d+\.\d{2}$/.test(value)) throw new Error("Invalid dashboard money value");
  const [major, minor] = value.split(".");
  const result = Number(major) * 100 + Number(minor);
  if (!Number.isSafeInteger(result)) throw new Error("Dashboard money value is too large");
  return result;
}

export function dashboardProductToMenuItem(product: DashboardProduct): MenuItem {
  return {
    id: product.slug ?? product.id,
    productId: product.id,
    name: product.name,
    description: product.description ?? "",
    image: product.image ?? "/images/cookie.png",
    priceMinor: decimalToMinor(product.price),
    inStock: product.inStock,
  };
}

export function dashboardMenuToCategories(menu: DashboardMenuCategory[]): MenuCategory[] {
  return menu.map((category) => ({
    id: category.id,
    title: category.title,
    subtitle: "",
    items: category.items.map(dashboardProductToMenuItem),
  }));
}

export function dashboardCartToLines(cart: DashboardCart): CartLine[] {
  return cart.lines.map((line) => ({
    id: line.slug ?? line.productId,
    productId: line.productId,
    name: line.name,
    description: "",
    priceMinor: decimalToMinor(line.price),
    currency: "AED",
    quantity: line.quantity,
    image: line.image ?? "/images/cookie.png",
  }));
}

export function dashboardOrderToOrder(order: DashboardOrder): Order {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    totalMinor: decimalToMinor(order.total),
    currency: "AED",
    createdAt: order.placedAt,
    fulfillment: "",
    items: order.items.map((item, index) => ({
      product_id: String(index),
      name_snapshot: item.name,
      quantity: item.quantity,
      unit_price_minor: decimalToMinor(item.price),
      currency: "AED",
    })),
  };
}

async function unwrap<T>(pending: Promise<FetchResult<{ data: T }>>): Promise<FetchResult<T>> {
  const result = await pending;
  if (!result.ok) return result;
  if (!result.data || !("data" in result.data)) {
    return { ok: false, status: result.status, error: { code: "BAD_RESPONSE", message: "Invalid storefront response" } };
  }
  return { ok: true, status: result.status, data: result.data.data };
}

export const dashboardGet = <T>(path: string) =>
  unwrap<T>(getJSON<{ data: T }>(path, { baseUrl: DASHBOARD_API_URL }));
export const dashboardPost = <T>(path: string, body: unknown, headers?: HeadersInit) =>
  unwrap<T>(postJSON<{ data: T }>(path, body, { baseUrl: DASHBOARD_API_URL, headers }));
export const dashboardPatch = <T>(path: string, body: unknown) =>
  unwrap<T>(patchJSON<{ data: T }>(path, body, { baseUrl: DASHBOARD_API_URL }));
export const dashboardDelete = <T>(path: string, body: unknown) =>
  unwrap<T>(deleteJSON<{ data: T }>(path, body, { baseUrl: DASHBOARD_API_URL }));
