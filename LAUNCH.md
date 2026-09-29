# Fluffy launch checklist

Record deployed staging evidence and an operator/date for each item. Local tests
verify code behavior; they do not prove production environment, backup, DNS or
Google configuration. The production stack is Coolify + admin-dashboard + MySQL;
the retired Fluffy backend and its tests are not release evidence.

## Customer and commercial correctness

- [ ] Catalogue and checkout sell from the intended dashboard branch.
- [ ] A displayed AED 48 product totals AED 48 for pickup with 5% included VAT.
- [ ] Quote and checkout agree after quantity, discount and delivery-zone changes.
- [ ] Discounts affect only eligible products/categories, honor limits, and reject consistently.
- [ ] Approved delivery zones/fees are installed; discounted subtotal AED 150 earns free delivery; below it the selected fee applies.
- [ ] Pickup, structured delivery address, cash labels and success receipt match the returned order.
- [ ] Tampered browser prices never change the server-calculated total; price changes are visible before ordering.
- [ ] Repeated checkout with one Idempotency-Key replays one order; a changed payload conflicts.
- [ ] Concurrent attempts for the last item create at most one reservation.
- [ ] Guest cart survives Google sign-in; unavailable/over-limit lines get clear feedback.
- [ ] All dashboard statuses have deliberate tracker states, including pickup readiness/collection and returns.
- [ ] Cancellation restores reserved stock and discount use; fulfilled cash orders record payment without charging already-paid orders twice.
- [ ] Order history/tracking respect ownership/contact verification and expose no private delivery details.

## Security and deployment

- [ ] STOREFRONT-audience key has required public scopes; staff/key-management routes reject it.
- [ ] API key exists only in Coolify server env; no credentials in source, client bundles, URLs or logs.
- [ ] Traefik preserves actual shopper identity; exhausting one shopper's budget does not throttle unrelated shoppers.
- [ ] Invalid keys, Google tokens, tracking guesses and client-error reports are rate limited.
- [ ] Cross-origin mutations fail; same-origin sign-in/cart/checkout succeed over deployed HTTPS.
- [ ] Session cookies are HttpOnly, Secure and SameSite=Lax; logout clears session/hint and dashboard revocation is tested.
- [ ] Oversized/object-invalid bridge bodies are rejected before reaching the dashboard.
- [ ] User APIs omit passwords, 2FA ciphertext, recovery material and revocation internals.
- [ ] DNS, TLS, headers and product sitemap work on the canonical storefront domain.
- [ ] MySQL port is blocked publicly, including the Hostinger firewall.
- [ ] Real Google account sign-in completes on the authorized public origin.

## Experience and operations

- [ ] Lint, TypeScript, unit/integration tests and production build pass on final branches.
- [ ] Production-build Playwright covers public routes, quote/promo flow and 360/768/1440px layouts.
- [ ] A real mid-tier phone on 4G completes pickup and delivery without sideways scrolling.
- [ ] Keyboard completes checkout; closed dialogs/menus cannot take focus; reduced motion works.
- [ ] Contact placeholders, business identity, allergens and policy copy match approved rules.
- [ ] Dashboard email, where configured, reaches an inbox; SPF/DKIM/DMARC verified.
- [ ] Coolify health checks hit API /api/v1/health and storefront successfully.
- [ ] Uptime/error alerts reach an actual operator; optional Sentry/log sink is not assumed configured.
- [ ] Scheduled MySQL backups exist and one restore was rehearsed with duration recorded.
- [ ] Runbook contacts and rollback/schema compatibility are reviewed.
- [ ] Tax/zone/stock-visibility configuration is verified in production after approved migration/seed.

## Release evidence

Record commit IDs for both repositories, migration/configuration versions, test
results, staging URLs, operator and date. Production deployment, key replacement
and live database writes require separate authorization; checking this document
does not perform or authorize them. Online card payments are not currently a
storefront feature and must not be claimed as tested.
