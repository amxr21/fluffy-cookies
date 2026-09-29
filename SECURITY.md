# Fluffy security posture

The active stack is the Next.js storefront, separate admin-dashboard API/admin UI,
and MySQL on Coolify/Traefik. The retired Fluffy backend is not deployed.
This document describes controls in code and remaining deployment checks; it is
not a claim that production has passed a penetration test. Updated 2026-09-28.

## Trust boundaries

The browser calls its own /api/storefront bridge. The bridge stores the
STOREFRONT-audience integration key on the server and exposes only explicitly
allowed public paths. The dashboard verifies the key, its audience and required
scope. A storefront key cannot authenticate as staff or manage keys.

Customers sign in with Google; the dashboard validates the ID token audience.
The bridge stores the customer token in a scoped HttpOnly cookie, with Secure
in production and SameSite=Lax. A readable signed-in cookie is only a hint,
contains no credential, and does not grant access. Identity/ownership are
verified by the dashboard, not from browser-supplied customer IDs.

Logout expires the local session and hint cookies. It does not itself revoke an
already copied dashboard customer JWT; that token remains subject to dashboard
expiry/revocation checks. There is no customer refresh-token rotation protocol.
Staff session revocation is a separate dashboard control.

## Public API and abuse controls

- The bridge rejects unsupported paths/methods, non-object mutation JSON,
  oversized bodies (64 KiB), and untrusted mutation Origins.
- Origin validation accepts the configured public site and the request's actual
  host/origin; X-Forwarded-Host is not accepted as authority.
- The bridge sends proxy-derived shopper identity to the dashboard. The
  dashboard trusts the header only after integration authentication; separate
  per-shopper/per-key budgets prevent one server hop from becoming one shopper.
- /api/client-log accepts at most 8 KiB, truncates known fields, and limits each
  address to 20 reports/minute and the process to 200/minute. Multiple replicas
  each have a budget. Reports are forgeable and must not be treated as audit evidence.
- Catalogue is public. Customer cart, wishlist and order history require customer
  identity. Guest tracking verifies order number/contact and returns limited data.
- Dashboard public user serializers use an explicit allowlist, excluding hashes,
  2FA ciphertext, recovery relations, lockout and revocation internals.

Traefik must supply trustworthy client headers. Validate the real proxy chain in
staging; static code checks cannot establish deployment trust. Restrict direct
application access so public clients cannot bypass the intended proxy.

## Commercial integrity

The dashboard recomputes authoritative prices, eligible discounts, inclusive VAT
and configured delivery fees. Quote and checkout share pricing code. Submitted
client prices are never authoritative. Stock is reserved transactionally;
checkout honors Idempotency-Key and rejects changed-payload key reuse.

Orders snapshot tax and delivery pricing. Cancellation restores reserved stock
and discount usage; fulfillment records unpaid cash without charging paid orders
again. Success-page query receipt fields are display hints; server-backed order
history/tracking remain the source of truth. Do not add contact data to those URLs.

## Headers, secrets and privacy

CSP, frame protection, MIME-sniff protection, referrer policy and HSTS are
configured in Next.js; X-Powered-By is disabled. Script CSP still permits
unsafe-inline because Next bootstrap scripts need nonce integration; production
does not enable unsafe-eval. Google sign-in requires permitted Google hosts and
popup communication. Revisit CSP when those integrations change.

Keep integration keys and database/signing/encryption secrets in the appropriate
Coolify environment store. NEXT_PUBLIC_* values enter browser bundles. Separate
dashboard secrets by purpose; review rotation effects on persisted 2FA data,
keys, reset links and sessions. Never log complete contact/authentication bodies.
Client errors can include user-authored messages/URLs: review retention and
redaction in monitoring before enabling third-party reporting.

MySQL must be inaccessible publicly; backups, encryption, access control and
restore rehearsal are deployment responsibilities. The app does not establish
legal compliance solely through these controls.

## Release checks and limitations

Follow [launch checks](LAUNCH.md) for ownership, key scope, proxy identity,
cross-origin mutations, stock contention, idempotency, body caps and real Google
sign-in. Inspect both server logs and browser console during staging verification.

Production key replacement, coordinated deployment, backup restoration rehearsal
and real-device/network checks require operator evidence. Online card payments,
payment webhooks and storefront variant selection are not implemented.
