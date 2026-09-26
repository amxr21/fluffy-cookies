/**
 * Transactional email.
 *
 * `/order-success` has always told customers "you'll receive a notification
 * once everything is ready" — and nothing sent one.
 *
 * Two rules from B9 shape this module:
 *
 * 1. Sending is best-effort and must NEVER fail the order. An order that
 *    exists but whose confirmation bounced is a support ticket; an order that
 *    was rejected because an email provider was down is lost revenue.
 * 2. Templates are data, not HTML built inside a handler, so they can be
 *    reviewed, changed, and eventually translated without touching logic.
 *
 * The provider is behind an adapter. Fluffy launches without one configured —
 * `RESEND_API_KEY` unset logs the message instead of sending, so the whole
 * pipeline is exercised in development and CI without a vendor account or a
 * single real email leaving the building.
 */
const config = require("../config");
const logger = require("../logger");
const templates = require("./templates");

/** Console adapter: the default until a provider is configured. */
const consoleAdapter = {
  name: "console",
  async send({ to, subject }) {
    logger.info("email.sent", { adapter: "console", to, subject });
    return { id: `console-${Date.now()}` };
  },
};

/**
 * Resend adapter. Built lazily so the dependency is only required when it is
 * actually configured — the package need not be installed to run the app.
 */
function resendAdapter(apiKey) {
  return {
    name: "resend",
    async send({ to, subject, html, text }) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.email.from, to, subject, html, text }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Resend rejected the message (${res.status}): ${body.slice(0, 200)}`);
      }
      return res.json();
    },
  };
}

const adapter = config.email.resendApiKey
  ? resendAdapter(config.email.resendApiKey)
  : consoleAdapter;

/**
 * Send one templated message.
 *
 * Never throws. A caller placing an order must not have to wrap this in a
 * try/catch to be correct — forgetting that once is how a provider outage
 * becomes a checkout outage.
 */
async function send(templateName, to, data) {
  const template = templates[templateName];
  if (!template) {
    logger.error("email.unknown_template", { template: templateName });
    return { sent: false, reason: "UNKNOWN_TEMPLATE" };
  }

  if (!to) {
    // A guest order with no email address is normal, not an error.
    return { sent: false, reason: "NO_RECIPIENT" };
  }

  const message = template(data);

  try {
    const result = await adapter.send({ to, ...message });
    logger.info("email.sent", {
      template: templateName,
      adapter: adapter.name,
      // Deliberately no recipient address and no body in the log — B10.8.
      messageId: result?.id,
    });
    return { sent: true, id: result?.id };
  } catch (err) {
    // Logged, not thrown: the order already exists and is more important than
    // its notification.
    logger.error("email.failed", {
      template: templateName,
      adapter: adapter.name,
      message: err.message,
    });
    return { sent: false, reason: "SEND_FAILED" };
  }
}

module.exports = { send, adapter, consoleAdapter, resendAdapter };
