# Fluffy — threat model and security posture

Per ECOMMERCE-STANDARD.md B10.0. Written for the specific store rather than as a
generic checklist: a surface inventory catches the one that matters, a checklist
usually does not.

Last reviewed: **2026-09-08**. Re-run after any change to auth, roles, pricing
or payments — and at a fixed cadence regardless.

---

## Surfaces

| Surface | Who can reach it | What they'd want | Control | State |
|---|---|---|---|---|
| Storefront reads (`/products`) | Anyone, incl. bots | Scrape the catalogue | Broad per-IP rate limit | ✅ |
| `POST /auth` | Anyone | Account takeover via a forged Google token | Google verifies the ID token; audience pinned; stricter auth rate limit | ✅ |
| Cart / checkout | Any session | Price tampering, oversell | Server recomputes every total from the database; the body supplies only product ids and quantities | ✅ price · ❌ stock |
| `GET /orders/track/:n` | **Anyone with a number** | Enumerate other customers' orders and addresses | Unguessable order number, allowlist projection (no PII), dedicated rate limit | ✅ |
| Customer routes (cart, likes, orders) | Any signed-in user | Read or modify another user's data (IDOR) | Identity comes from the token, never the body or the URL; a mismatched `:userId` is 403 | ✅ |
| `/admin/*` | Anyone who finds it | Full store control, customer PII, refunds | `requireAdmin` re-checks the role against the database | ⚠️ middleware verified, no routes yet |
| Payment webhooks | Anyone on the internet | Mark an unpaid order paid | Signature verification + idempotent handlers | ❌ not built |
| Upload endpoints | — | Malware host, stored XSS | — | n/a, no uploads |
| The database | Whoever finds the host | Everything | Private networking, no public accessibility | ⚠️ deploy-time, unverified |

## What an attacker gets from each token

- **Access token** — 15 minutes of that user's API access. httpOnly, so an
  injected script cannot read it. Invalidated early by a `token_version` bump.
- **Refresh token** — a new session, *once*. Rotates on use; presenting a spent
  one revokes the whole family. Stored only as a SHA-256 hash, so a database
  leak yields nothing usable.
- **Order number** — the status and contents of one order. No customer identity,
  no address, no phone.

## Decisions worth writing down

**CSRF is handled by proxying, not tokens.** The storefront calls the API
through a Next rewrite on its own origin, so auth cookies stay `SameSite=Lax`
and the browser's built-in protection applies.

This is one decision, not two: if the browser ever calls the API cross-site
again, `SameSite=Lax` silently stops sending the cookie and the failure looks
like "randomly signed out", not a config error. Change the proxy and the cookie
attribute together or neither.

Consequence: the API is reachable only through the storefront. An admin
dashboard calling it directly needs its own origin in `ALLOWED_ORIGINS` and its
own auth path.

**Legacy order numbers are still sequential.** Orders placed before
migration 004 keep `FL1001`-style numbers, because customers hold them on
confirmations and renumbering would break tracking for every open order. The
tracking rate limit is what bounds their exposure until they age out.

**Reuse detection signs out the legitimate user too.** When a spent refresh
token is replayed, the whole family is revoked — including the real user's
current session. That is the correct trade: the alternative leaves an attacker
holding a valid session.

## Known gaps

Tracked, not forgotten. Each is a wave item.

- **No email verification** — an account can order without proving the address.
- **No password reset or lockout** — Google is the only identity today, so there
  is no password to reset; both land with email/password auth if it is added.
- **No stock model** — every product is infinitely orderable. Not a security
  hole on its own, but oversell under a promotion is the same class of race.
- **No CSP on the frontend** — the API sets `helmet` with CSP off (correct for
  a JSON API), but the storefront ships no policy.
- **Database exposure is unverified** — "not reachable from an arbitrary
  machine" is a deploy-time property and has not been tested.
- **No dependency audit in CI** — Dependabot opens PRs; nothing fails a build.

## The twelve-attack review

B10.9 requires each of these attempted against a running staging build, dated,
with the result recorded. **Not yet run** — it is a launch-gate line.

Where a test already covers the attack, it is named. A green test is evidence
the control exists; it is not a substitute for trying the attack against a
deployed instance.

| # | Attack | Covered by | Run against staging |
|---|---|---|---|
| 1 | Post a cart with tampered prices | `orderPricing.test.js` | ☐ |
| 2 | Call an admin route with a customer token | `accessControl.test.js` | ☐ |
| 3 | Read another user's order, cart and likes by id | `accessControl.test.js` | ☐ |
| 4 | Promote yourself via a `role` field | `accessControl.test.js` | ☐ |
| 5 | Reuse an expired / over-limit discount code | — (not built) | ☐ |
| 6 | Replay a payment webhook; forge one | — (not built) | ☐ |
| 7 | Two concurrent orders for the last unit | — (no stock model) | ☐ |
| 8 | Brute-force order numbers against tracking | `orderPrivacy.test.js` | ☐ |
| 9 | Store `<script>` in a review, open the admin queue | — (no reviews) | ☐ |
| 10 | Hit a rate limit from two IPs, confirm it is per-IP | — | ☐ |
| 11 | Upload a non-image with an image extension | n/a (no uploads) | ☐ |
| 12 | Connect to the database from an arbitrary machine | — | ☐ |

**#10 deserves attention at deploy time.** `trust proxy` is set to `1`. Behind a
Vercel/Render-style split that is usually right, but if it is wrong the limiter
reads the proxy's IP and every per-IP limit silently becomes global — or worse,
a client-supplied `X-Forwarded-For` defeats it entirely. Verify by hitting the
limit from one machine and confirming a second is unaffected.

## Reporting a vulnerability

`security.txt` is not published yet (B10.9). Until it is, report to the
repository owner directly.
