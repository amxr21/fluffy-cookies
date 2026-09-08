# Fluffy — runbook

Written for whoever inherits this at 2am. Assumes no prior context.

**Frontend:** Next.js (Vercel) · **API:** Express (Render) · **Database:** MySQL

---

## Is it broken?

```bash
curl https://api.fluffy.ae/health
```

| Response | Meaning |
|---|---|
| `{"status":"ok","db":"up"}` | Healthy |
| `{"status":"degraded","db":"down"}` | API is up, database is not — start at *Database down* |
| No response / timeout | API is down — start at *API down* |

The storefront can render its cached menu while the API is down. Sign-in,
cart and checkout cannot work.

## Finding out what happened

Every response carries `x-request-id`, and every error shown to a customer
includes it. **That string is the fastest route to the cause.**

```bash
# The whole story of one request, in order
grep '<requestId>' backend/logs/app-$(date +%F).log
```

Logs live in `backend/logs/`, rotating daily, kept 14 days. `app-*` is the
application channel, `db-*` is query failures.

Unexpected errors also reach Sentry, tagged with the same `requestId`.
**Expected failures — a 404, a rejected discount code — are deliberately not
sent**, so the Sentry inbox stays readable.

---

## API down

1. Check the host's dashboard for a crashed or restarting instance.
2. Check the most recent deploy — if it correlates, **roll back first, diagnose after**.
3. Look for a boot failure. The server exits immediately on missing config:
   ```
   Missing required environment variables: JWT_SECRET
   ```
   That is a config problem, not a code one. Check the host's env vars.
   `JWT_SECRET` must be at least 32 characters or the process refuses to start.

## Database down

1. Confirm the database itself is up in its own dashboard.
2. Check connection limits — `DB_CONNECTION_LIMIT` defaults to 10. Exhaustion
   looks like slow requests before it looks like failures.
3. Check `backend/logs/db-*.log` for the actual driver error.
4. If credentials rotated, update `DB_PASSWORD` on the host and restart.

## Rolling back

**Frontend (Vercel):** promote the previous deployment. Instant, no build.

**API (Render):** redeploy the previous commit.

> **Migrations do not roll back.** If the bad deploy applied one, rolling back
> the code leaves the schema ahead. Check `schema_migrations` and decide
> deliberately — usually forward-fixing is safer than reversing a migration.

## Restoring the database

1. Take the most recent automated backup from the database host.
2. Restore into a **new** database first, never over the live one.
3. Verify: row counts on `orders`, and that the newest order matches what
   customers report.
4. Repoint `DB_NAME` and restart.

> **This has not been rehearsed yet.** Do it once against a scratch database and
> record how long it took, before you need it. An untested backup is a hope.

## Rotating a secret

`JWT_SECRET` — rotating it **signs out every customer immediately**, because
every existing access token fails verification. Acceptable in an incident,
disruptive otherwise.

`GOOGLE_CLIENT_ID` — must be changed on the frontend and backend **together**.
A mismatch fails every sign-in with a generic "sign-in failed", which looks
like a code bug rather than a config one.

`DB_PASSWORD` — change at the database, then on the host, then restart.

`RESEND_API_KEY` — safe to rotate. Email is best-effort; a bad key logs a
failure and never blocks an order.

All secrets live in the host's env store. **None are in git**, and a committed
secret is a rotate-everything incident because git history is forever.

---

## Things that look broken but are not

**"Randomly signed out."** Refresh tokens rotate on use, and presenting a spent
one revokes the whole family by design — that is reuse detection working. It
becomes a bug only if it happens to many customers at once, which would point at
the shared in-flight refresh in `safeFetch` failing.

**Everything is sold out.** `track_stock` is on for a product with no counted
stock. Set a real count via `PATCH /api/v1/admin/stock/:productId`, or turn
tracking off for made-to-order items.

**A customer's discount code "stopped working."** Check `used_count` against
`usage_limit`, and `discount_redemptions` for a per-user limit already spent.

**Order tracking says not found.** Order numbers exclude I, L, O and U to avoid
misreading. The API already maps those, but confirm the customer is not reading
a number from a different order.

---

## Who to call

| Area | Contact |
|---|---|
| Hosting (Vercel / Render) | *(fill in)* |
| Database | *(fill in)* |
| Domain / DNS | *(fill in)* |
| Business owner | *(fill in)* |

**Fill these in before you need them.** A runbook with blank contacts fails at
exactly the moment it is opened.
