# Fluffy runbook

Production consists of the Fluffy Next.js storefront, the separate admin-dashboard
API and admin UI, and MySQL, hosted on a Hostinger VPS through Coolify and Traefik.
The retired Fluffy Express backend is not a deployment target.
See [integration setup](HOW-TO-CONNECT-ADMIN-DASHBOARD.md) for exact app commands,
ports, environment variables and migration startup behavior.

## Establish which service failed

Check the public storefront, /api/storefront/config, /menu, and the dashboard
API's /api/v1/health. Check the health status and logs of each Coolify resource.
The storefront can serve a briefly cached catalogue while the API is unavailable;
sign-in, cart and checkout require the dashboard.

| Symptom | First check |
|---|---|
| Storefront 502 or 503 | API health, server-only API_ORIGIN, integration key and selling branch |
| Menu unavailable | Active categorized products, branch stock, DASHBOARD_BRANCH_ID and key scopes |
| Mutations return 403 | Browser Origin, public storefront host and NEXT_PUBLIC_SITE_URL; rebuild after changing public env |
| Many shoppers receive 429 together | Traefik client IP headers, bridge X-Storefront-Client-IP, and dashboard per-key/per-shopper budgets |
| Sign-in fails | Matching Google client IDs and storefront authorized JavaScript origin |
| Quote changes or rejects checkout | Current prices, stock, discount eligibility and selected delivery zone |
| Orders are missing | Intended dashboard database/branch; search the returned order number |
| Client reports disappear | /api/client-log caps reports at 8 KiB and rate limits by address/process; consult API logs too |

Use Coolify application logs for the storefront and API. Dashboard requests use
structured logging; correlate by request ID where available. Do not assume the
bridge forwards every upstream diagnostic header. Never paste customer bodies,
addresses, credentials or tokens into incident notes. The storefront's client-log
sink is best-effort reporting, not durable monitoring.

## API or database outage

1. Check recent deployments and crash-loop logs. Missing or invalid environment
   configuration is a boot failure, not a catalogue defect.
2. Check MySQL health, storage, connection capacity and the configured internal
   hostname. Container IPs change; use the Coolify resource hostname.
3. Confirm APP_MODE=prod and DATABASE_URL_PROD on the dashboard API. Update
   that URL when credentials rotate; the storefront has no database credentials.
4. If deployment introduced the outage, redeploy the last compatible commit
   in Coolify. Preserve logs before restarting.

## Rollback and restore

Roll back app code through Coolify deployment history or redeploy a known commit.
Dashboard startup applies Prisma migrations; code rollback does not reverse them.
Review compatibility with the current schema before rolling back. Never use
prisma migrate reset or db push against production.

Restore backups into a separate database first. Verify recent order numbers,
totals, tax/delivery snapshots, stock and discount usage. Record the backup age
and restore duration, then change DATABASE_URL_PROD deliberately. Scheduled
backups and a rehearsed restore are launch requirements; this document does not
claim they have been configured or tested in production.

## Pricing and fulfillment

The dashboard quote and checkout service owns prices, discounts, VAT and delivery
fees. Fluffy uses 5% VAT-inclusive prices. Its approved delivery table is Al Ain
AED 15, Abu Dhabi AED 25, Dubai/Sharjah AED 30, and Northern Emirates AED 40;
delivery is free when the discounted merchandise subtotal reaches AED 150.
Zones are generic dashboard records, with store.deliveryZonesEnabled enabled
for Fluffy. Pickup carries no delivery fee. Apply reviewed seed/configuration SQL
only to the intended database; a local QA seed is not production evidence.

Orders reserve stock. Cancellation returns reserved stock and releases discount
usage; fulfillment records outstanding cash payment on delivery/collection.
Use supported cancellation/return workflows and preserve the audit trail; do not
edit historical pricing snapshots or manually move orders backwards to repair disputes.

## Credential rotation

Create a replacement STOREFRONT-audience key with required public scopes,
update DASHBOARD_API_KEY in the storefront Coolify resource, verify catalogue
and checkout, then revoke the old key. Never use a NEXT_PUBLIC_* variable.
Dashboard JWT rotation invalidates affected sessions. API-key, reset-code and
2FA encryption secrets have separate purposes; review their effect on stored
credentials before rotation. Google client ID changes require coordinated API
update and storefront rebuild. Keep MySQL inaccessible through the public firewall.

## Incident contacts

| Area | Contact to fill before launch |
|---|---|
| Hostinger/Coolify operator | Pending |
| Database/backup owner | Pending |
| Domain/DNS owner | Pending |
| Business owner | Pending |
