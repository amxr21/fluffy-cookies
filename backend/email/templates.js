/**
 * Email templates — data, not HTML assembled inside a handler.
 *
 * Each template is a function of its data returning `{ subject, html, text }`.
 * Every message ships both parts: a text/plain alternative measurably improves
 * inbox placement, and some clients still show it.
 *
 * Structured this way so a locale argument can be added later without touching
 * any calling code (B9: "bilingual-ready").
 */
const { formatMinor } = require("../lib/money");

/** Escape anything customer-supplied. A name is untrusted input here too. */
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const BRAND = "#2f468e";

/** Shared shell, so a template only writes its own body. */
const layout = (title, body) => `<!doctype html>
<html><body style="margin:0;background:#fcefd6;font-family:system-ui,-apple-system,sans-serif;color:#090d1b">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="color:${BRAND};font-size:24px;margin:0 0 8px">${esc(title)}</h1>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#5d3f28">
      Fluffy — handcrafted cookies &amp; specialty coffee, Al Ain, UAE
    </p>
  </div>
</body></html>`;

const itemRows = (items = []) =>
  items
    .map(
      (it) =>
        `<tr><td style="padding:4px 0">${esc(it.name_snapshot)} × ${esc(it.quantity)}</td>` +
        `<td style="padding:4px 0;text-align:right">${esc(
          formatMinor(it.unit_price_minor * it.quantity, it.currency)
        )}</td></tr>`
    )
    .join("");

const itemLines = (items = []) =>
  items
    .map(
      (it) =>
        `  ${it.name_snapshot} x ${it.quantity} — ${formatMinor(
          it.unit_price_minor * it.quantity,
          it.currency
        )}`
    )
    .join("\n");

const templates = {
  /** Sent immediately on placement — the receipt a customer keeps. */
  orderConfirmed: (order) => ({
    subject: `Your Fluffy order ${order.orderNumber} is confirmed`,
    html: layout(
      "Thanks for your order",
      `<p>We've got it, and we'll let you know the moment it's ready.</p>
       <p style="font-size:18px"><strong>Order ${esc(order.orderNumber)}</strong></p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         ${itemRows(order.items)}
         <tr><td style="border-top:1px solid #2f468e33;padding-top:8px"><strong>Total</strong></td>
             <td style="border-top:1px solid #2f468e33;padding-top:8px;text-align:right">
               <strong>${esc(formatMinor(order.totalMinor, order.currency))}</strong></td></tr>
       </table>
       <p>Track it any time with your order number — no account needed.</p>`
    ),
    text: `Thanks for your order.

Order ${order.orderNumber}
${itemLines(order.items)}
Total: ${formatMinor(order.totalMinor, order.currency)}

Track it any time with your order number — no account needed.`,
  }),

  /** The message /order-success has been promising all along. */
  orderReady: (order) => ({
    subject: `Your Fluffy order ${order.orderNumber} is ready`,
    html: layout(
      "Your order is ready",
      `<p>Order <strong>${esc(order.orderNumber)}</strong> is ready for ${
        order.fulfillment === "Delivery" ? "delivery" : "collection"
      }.</p>
       <p>Please bring your order number with you.</p>`
    ),
    text: `Your Fluffy order ${order.orderNumber} is ready for ${
      order.fulfillment === "Delivery" ? "delivery" : "collection"
    }.

Please bring your order number with you.`,
  }),

  orderCancelled: (order) => ({
    subject: `Your Fluffy order ${order.orderNumber} was cancelled`,
    html: layout(
      "Order cancelled",
      `<p>Order <strong>${esc(order.orderNumber)}</strong> has been cancelled.</p>
       <p>If you weren't expecting this, please get in touch and we'll sort it out.</p>`
    ),
    text: `Your Fluffy order ${order.orderNumber} has been cancelled.

If you weren't expecting this, please get in touch and we'll sort it out.`,
  }),
};

module.exports = templates;
