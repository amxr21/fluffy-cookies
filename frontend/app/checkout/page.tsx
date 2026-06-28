"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/providers/ToastProvider";
import { useCart } from "@/context/CartContext";
import { postJSON } from "@/lib/safeFetch";
import { AUTH_KEYS } from "@/lib/config";

type PaymentMethod = "cash" | "card-on-delivery" | "online";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash on Delivery" },
  { value: "card-on-delivery", label: "Card on Delivery" },
  { value: "online", label: "Pay Online (coming soon)" },
];

const FULFILLMENT_OPTIONS = [
  { value: "Pickup", label: "Pickup" },
  { value: "Delivery", label: "Delivery" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useToast();
  const { lines, subtotal, clearCart } = useCart();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    note: "",
  });
  const [fulfillment, setFulfillment] = useState("Pickup");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [discount, setDiscount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      toast.info("Your cart is empty");
      return;
    }
    if (payment === "online") {
      toast.info("Online payment is coming soon — pick Cash or Card on Delivery.");
      return;
    }
    setSubmitting(true);
    const userId =
      typeof window !== "undefined"
        ? localStorage.getItem(AUTH_KEYS.userId)
        : null;

    const res = await postJSON<{ orderNumber: string }>("/orders", {
      user_id: userId,
      fulfillment,
      payment,
      discount_code: discount || undefined,
      contact: form,
      items: lines.map((l) => ({ product_id: l.id, quantity: l.quantity })),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error.message || "Couldn't place your order");
      return;
    }
    clearCart();
    const ref = res.data?.orderNumber ?? "";
    router.push(`/order-success${ref ? `?order=${encodeURIComponent(ref)}` : ""}`);
  };

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <h1 className="mb-8 text-center text-h2 uppercase text-navy">Checkout</h1>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"
        >
          {/* contact + delivery */}
          <div className="space-y-5 rounded-3xl border border-navy/15 bg-white/40 p-6">
            <h2 className="text-h4 font-bold text-navy">Contact & Delivery</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-small text-navy/80">
                Full name
                <input
                  required
                  className="fluffy-field"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-small text-navy/80">
                Phone
                <input
                  required
                  className="fluffy-field"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1 text-small text-navy/80">
              <span>Fulfillment</span>
              <Dropdown
                ariaLabel="Fulfillment method"
                value={fulfillment}
                options={FULFILLMENT_OPTIONS}
                onChange={setFulfillment}
              />
            </div>

            {fulfillment === "Delivery" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-small text-navy/80 sm:col-span-2">
                  Address
                  <input
                    required
                    className="fluffy-field"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-small text-navy/80">
                  City
                  <input
                    required
                    className="fluffy-field"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1 text-small text-navy/80">
              Note (optional)
              <textarea
                rows={3}
                className="fluffy-field resize-none"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </label>
          </div>

          {/* summary + payment */}
          <div className="space-y-5 rounded-3xl border border-navy/15 bg-beige/40 p-6">
            <h2 className="text-h4 font-bold text-navy">Order Summary</h2>

            <ul className="space-y-2 text-small text-navy/80">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {l.name} × {l.quantity}
                  </span>
                  <span className="shrink-0">AED {(l.price * l.quantity).toFixed(0)}</span>
                </li>
              ))}
              {lines.length === 0 && (
                <li className="text-navy/50">Your cart is empty.</li>
              )}
            </ul>

            <label className="flex flex-col gap-1 text-small text-navy/80">
              Discount code
              <input
                className="fluffy-field"
                placeholder="e.g. FLUFFY10"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </label>

            <div className="flex flex-col gap-1 text-small text-navy/80">
              <span>Payment method</span>
              <Dropdown
                ariaLabel="Payment method"
                value={payment}
                options={PAYMENT_OPTIONS}
                onChange={(v) => setPayment(v as PaymentMethod)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-navy/20 pt-4">
              <span className="text-h4 font-bold text-navy">Total</span>
              <span className="text-h4 font-bold text-navy">
                AED {subtotal.toFixed(1)}
              </span>
            </div>

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Placing order…" : "Place Order"}
            </Button>
          </div>
        </form>
      </Container>
    </main>
  );
}
