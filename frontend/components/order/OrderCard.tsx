import type { Order } from "@/lib/orders";
import { formatMinor, lineTotalMinor } from "@/lib/money";

export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="rounded-2xl border border-navy/15 bg-white/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-h4 font-bold text-navy">#{order.orderNumber}</p>
        <span className="rounded-full bg-navy/10 px-3 py-1 text-caption font-semibold uppercase tracking-wide text-navy">
          {order.status}
        </span>
      </div>

      <p className="mt-1 text-caption text-navy/50">
        {new Date(order.createdAt).toLocaleDateString()} · {order.fulfillment}
      </p>

      <ul className="mt-3 space-y-1 text-small text-navy/80">
        {order.items.map((it) => (
          <li key={it.product_id} className="flex justify-between gap-3">
            <span className="truncate">
              {it.name_snapshot} × {it.quantity}
            </span>
            <span className="shrink-0">{formatMinor(lineTotalMinor(it.unit_price_minor, it.quantity), it.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between border-t border-navy/15 pt-3 text-body font-bold text-navy">
        <span>Total</span>
        <span>{formatMinor(order.totalMinor, order.currency)}</span>
      </div>
    </article>
  );
}
