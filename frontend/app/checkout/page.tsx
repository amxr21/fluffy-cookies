"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input, Textarea } from "@/components/ui/Field";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/providers/ToastProvider";
import { useCart } from "@/context/CartContext";
import { postJSON } from "@/lib/safeFetch";
import { AUTH_KEYS } from "@/lib/config";

type PaymentMethod = "cash" | "card-on-delivery" | "online";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash on Delivery" },
  { value: "card-on-delivery", label: "Card on Delivery" },
  // Not selectable until online payments ship — shown so customers know it's
  // planned, greyed out so it can't be chosen and then rejected on submit.
  { value: "online", label: "Pay Online", disabled: true, note: "Coming soon" },
];

const FULFILLMENT_OPTIONS = [
  { value: "Pickup", label: "Pickup" },
  { value: "Delivery", label: "Delivery" },
];

type FormField = "name" | "phone" | "address" | "city" | "note";

/** Focus order for jumping to the first invalid field. */
const FIELD_ORDER: FormField[] = ["name", "phone", "address", "city"];

/** UAE mobile numbers: 05X XXX XXXX, tolerant of spaces/dashes and +971. */
const PHONE_RE = /^(?:\+?971|0)(?:\s|-)?5\d(?:\s|-)?\d{3}(?:\s|-)?\d{4}$/;

function validate(
  form: Record<FormField, string>,
  fulfillment: string
): Partial<Record<FormField, string>> {
  const errors: Partial<Record<FormField, string>> = {};

  if (!form.name.trim()) errors.name = "Please enter your name.";
  else if (form.name.trim().length < 2) errors.name = "That name looks too short.";

  const phone = form.phone.trim();
  if (!phone) errors.phone = "Please enter your phone number.";
  else if (!PHONE_RE.test(phone))
    errors.phone = "Enter a UAE mobile number, e.g. 050 123 4567.";

  // Address only applies to delivery orders.
  if (fulfillment === "Delivery") {
    if (!form.address.trim()) errors.address = "Please enter your address.";
    if (!form.city.trim()) errors.city = "Please enter your city.";
  }

  return errors;
}

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
  /** Field errors shown inline. Populated on submit, cleared as the user types. */
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear the error as soon as the field is touched — re-validated on submit.
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      toast.info("Your cart is empty");
      return;
    }

    // Validate in-app rather than letting the browser show its own bubble
    // (the form sets noValidate). Errors render under each field.
    const next = validate(form, fulfillment);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      // Move focus to the first problem so keyboard users land on it.
      const first = FIELD_ORDER.find((f) => next[f]);
      if (first) {
        document
          .querySelector<HTMLElement>(`[data-field="${first}"]`)
          ?.focus();
      }
      toast.error("Please check the highlighted fields.");
      return;
    }
    setErrors({});

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
      items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
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

        {/* noValidate: we render our own inline errors instead of the
            browser's unstyleable native validation bubble. */}
        <form
          noValidate
          onSubmit={handleSubmit}
          className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"
        >
          {/* contact + delivery */}
          <div className="space-y-5 rounded-3xl border border-navy/15 bg-white/40 p-6">
            <h2 className="text-h4 font-bold text-navy">Contact & Delivery</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                required
                data-field="name"
                error={errors.name}
                autoComplete="name"
                placeholder="e.g. Ammar Al Nuaimi"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
              <Input
                label="Phone"
                required
                data-field="phone"
                error={errors.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05X XXX XXXX"
                hint="We'll only use this about your order."
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
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
                <Input
                  label="Address"
                  required
                  data-field="address"
                  error={errors.address}
                  autoComplete="street-address"
                  placeholder="Building, street, area"
                  className="sm:col-span-2"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
                <Input
                  label="City"
                  required
                  data-field="city"
                  error={errors.city}
                  autoComplete="address-level2"
                  placeholder="Al Ain"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            )}

            <Textarea
              label="Note"
              rows={3}
              maxLength={300}
              placeholder="Allergies, gift message, delivery instructions…"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
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

            <Input
              label="Discount code"
              placeholder="e.g. FLUFFY10"
              autoCapitalize="characters"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />

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
