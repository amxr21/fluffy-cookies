"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input, Textarea } from "@/components/ui/Field";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/providers/ToastProvider";
import { useCart } from "@/context/CartContext";
import { dashboardPost, decimalToMinor } from "@/lib/dashboard";
import { useAuth } from "@/context/AuthContext";
import { useCheckoutQuote } from "@/lib/useCheckoutQuote";
import { formatMinor, lineTotalMinor } from "@/lib/money";

type PaymentMethod = "cash" | "card-on-delivery" | "online";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash on Delivery" },
  { value: "card-on-delivery", label: "Card on Delivery" },
  // Not selectable until online payments ship — shown so customers know it's
  // planned, greyed out so it can't be chosen and then rejected on submit.
  { value: "online", label: "Pay Online", disabled: true, note: "Coming soon" },
];

/** Emirates Fluffy delivers to. For choosing only — the dashboard prices the
 *  order, so nothing here decides what is charged. */
const EMIRATE_OPTIONS = [
  { value: "Al Ain", label: "Al Ain" },
  { value: "Abu Dhabi", label: "Abu Dhabi" },
  { value: "Dubai", label: "Dubai" },
  { value: "Sharjah", label: "Sharjah" },
  { value: "Ajman", label: "Ajman" },
  { value: "Umm Al Quwain", label: "Umm Al Quwain" },
  { value: "Ras Al Khaimah", label: "Ras Al Khaimah" },
  { value: "Fujairah", label: "Fujairah" },
];

const FULFILLMENT_OPTIONS = [
  { value: "Pickup", label: "Pickup" },
  { value: "Delivery", label: "Delivery" },
];

type FormField = "name" | "phone" | "email" | "emirate" | "address" | "city" | "note";

/** Focus order for jumping to the first invalid field. */
const FIELD_ORDER: FormField[] = ["name", "phone", "email", "emirate", "address", "city"];

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

  // Optional, but validated when given: a typo means the confirmation goes
  // nowhere and the customer never knows why.
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "That email doesn't look right.";
  }

  // Address only applies to delivery orders.
  if (fulfillment === "Delivery") {
    // The emirate is what the delivery zone and fee are resolved from, so a
    // delivery order without one cannot be priced.
    if (!form.emirate.trim()) errors.emirate = "Please choose your emirate.";
    if (!form.address.trim()) errors.address = "Please enter your address.";
    if (!form.city.trim()) errors.city = "Please enter your city.";
  }

  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useToast();
  const { lines, clearCart } = useCart();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    emirate: "",
    address: "",
    city: "",
    note: "",
  });
  const [fulfillment, setFulfillment] = useState("Pickup");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [promoDraft, setPromoDraft] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const { quote, error: pricingError, loading: pricingLoading, refresh: refreshQuote } = useCheckoutQuote(lines, discountCode, user?.userId);
  /** Field errors shown inline. Populated on submit, cleared as the user types. */
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  /**
   * Idempotency key for this checkout attempt. Held in a ref, not state, so a
   * retry after a failure reuses the SAME key — that is what makes a retry safe
   * rather than a second order. Cleared only once an order is actually placed.
   */
  const idempotencyKey = useRef<string | null>(null);
  const attemptBody = useRef<string | null>(null);

  const taxMinor = quote ? decimalToMinor(quote.taxAmount) : 0;
  const totalMinor = quote ? decimalToMinor(quote.total) : 0;
  const priceChanged = quote?.lines.some(priced => lines.some(line => line.productId === priced.productId && line.priceMinor !== decimalToMinor(priced.price))) ?? false;
  const summaryLines = quote ? quote.lines.map(priced => ({ id: priced.productId, name: priced.name, quantity: priced.quantity, priceMinor: decimalToMinor(priced.price), currency: "AED" })) : lines;
  const paymentOptions = PAYMENT_OPTIONS.map(option => fulfillment === "Pickup" ? { ...option, label: option.label.replace("on Delivery", "on Pickup") } : option);

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
    if (!quote || pricingLoading || pricingError) {
      toast.error("Store pricing is unavailable. Please try again shortly.");
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

    const body = {
      items: lines.map((line) => ({ productId: String(line.productId), quantity: line.quantity })),
      contact: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(fulfillment === "Delivery" ? {
          address: `${form.address.trim()}, ${form.emirate.trim()}`,
          city: form.city.trim(),
        } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      },
      paymentMethod: payment,
      fulfillment,
      ...(quote.discountCode ? { discountCode: quote.discountCode } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (!idempotencyKey.current || attemptBody.current !== fingerprint) {
      idempotencyKey.current = crypto.randomUUID();
      attemptBody.current = fingerprint;
    }
    const res = await dashboardPost<{ orderNumber: string; total: string }>("/orders", body, { "Idempotency-Key": idempotencyKey.current });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message || "Couldn't place your order");
      return;
    }
    idempotencyKey.current = null;
    attemptBody.current = null;
    clearCart();
    // The order response carries no fulfillment; it is what the shopper chose here.
    router.push(`/order-success?${new URLSearchParams({ order: res.data.orderNumber, fulfillment: fulfillment.toUpperCase(), totalMinor: String(decimalToMinor(res.data.total)) })}`);
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

            <Input
              label="Email"
              type="email"
              data-field="email"
              error={errors.email}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              hint="Optional — use this for order enquiries."
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />

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
                <div className="flex flex-col gap-1 text-small text-navy/80 sm:col-span-2">
                  <span>Emirate</span>
                  <Dropdown
                    ariaLabel="Emirate"
                    value={form.emirate}
                    options={EMIRATE_OPTIONS}
                    onChange={(v) => set("emirate", v)}
                  />
                  {errors.emirate && (
                    <span className="text-caption text-red-700">{errors.emirate}</span>
                  )}
                </div>
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
              {summaryLines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {l.name} × {l.quantity}
                  </span>
                  <span className="shrink-0">
                    {formatMinor(lineTotalMinor(l.priceMinor, l.quantity), l.currency)}
                  </span>
                </li>
              ))}
              {lines.length === 0 && (
                <li className="text-navy/50">Your cart is empty.</li>
              )}
            </ul>

            <div className="flex flex-col gap-1 text-small text-navy/80">
              <span>Payment method</span>
              <Dropdown
                ariaLabel="Payment method"
                value={payment}
                options={paymentOptions}
                onChange={(v) => setPayment(v as PaymentMethod)}
              />
            </div>

            <div className="flex items-center justify-between text-small text-navy/80">
              <span>{quote?.pricesIncludeTax ? "Includes VAT" : "VAT"}</span>
              <span>{quote ? formatMinor(taxMinor) : "—"}</span>
            </div>

            <div className="space-y-3">
              <Input label="Promo code" maxLength={64} value={promoDraft} onChange={event => setPromoDraft(event.target.value)} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={submitting || !promoDraft.trim()} onClick={() => setDiscountCode(promoDraft.trim())}>Apply code</Button>
                {discountCode && <Button type="button" variant="outline" disabled={submitting} onClick={() => { setDiscountCode(""); setPromoDraft(""); }}>Remove code</Button>}
              </div>
              {quote?.discountCode && <p className="text-small text-navy">{quote.discountCode}: −{formatMinor(decimalToMinor(quote.discountAmount))}</p>}
            </div>
            {priceChanged && <p role="status" className="text-small text-brown">Prices have changed since you added items. The summary shows current prices.</p>}
            {pricingError && <div className="space-y-2"><p role="alert" className="text-small text-brown">{pricingError}</p><Button type="button" variant="outline" onClick={refreshQuote}>Retry pricing</Button></div>}

            <div className="flex items-center justify-between border-t border-navy/20 pt-4">
              <span className="text-h4 font-bold text-navy">Total</span>
              <span className="text-h4 font-bold text-navy">
                {quote ? formatMinor(totalMinor) : pricingLoading ? "Loading…" : "—"}
              </span>
            </div>

            <Button type="submit" fullWidth disabled={submitting || !quote || pricingLoading || Boolean(pricingError) || lines.length === 0}>
              {submitting ? "Placing order…" : "Place Order"}
            </Button>
          </div>
        </form>
      </Container>
    </main>
  );
}
