# Fluffy — launch checklist

Section C of ECOMMERCE-STANDARD.md. **The store does not go live until every
line is checked and dated.**

Everything here needs a deployed environment — none of it can be verified from
the repository, which is why it is the last thing rather than the first.

Where a test already covers the behaviour, it is named. **A green test is
evidence the control exists in the code; it is not evidence it works in the
deployment**, which is a different claim and the one this document is about.

---

## Correctness

| Check | Covered by | Verified |
|---|---|---|
| A cart POSTed with tampered prices produces a correct charge | `orderPricing.test.js` | ☐ |
| A non-admin is refused by the API on every admin route | `accessControl.test.js` | ☐ |
| Order 1042 cannot be read by the wrong user | `accessControl.test.js` | ☐ |
| Two concurrent checkouts on the last unit → one order, one rejection | `stock.test.js` | ☐ |
| An expired / over-limit / ineligible discount code is refused | `discounts.test.js` | ☐ |
| A duplicated webhook produces exactly one payment record | — payments not built | ☐ |
| A double-clicked "Place order" produces one order | `orderIdempotency.test.js` | ☐ |

## Security — the twelve-attack review

Run each against **staging**, record the date and result. See
`backend/SECURITY.md` for the full table and what each attack targets.

| Check | Verified |
|---|---|
| Database not reachable from an arbitrary machine | ☐ |
| CSRF decision implemented (proxied same-site — see SECURITY.md) | ☐ |
| **Rate limits verified per-IP, not global** | ☐ |
| Stored XSS attempted and confirmed contained | ☐ |
| No secret in git history; all secrets in the host env store | ☐ |
| `security.txt` published **and the mailbox confirmed to exist** | ☐ |

> **The rate-limit check deserves real attention.** `trust proxy` is set to `1`.
> On a Vercel-frontend / Render-backend split that is usually right, but if it is
> wrong every per-IP limit silently becomes global — or a client-supplied
> `X-Forwarded-For` defeats it entirely. **Verify by hitting a limit from one
> machine and confirming a second machine is unaffected.** Both failure modes
> look like a working rate limiter until someone tests them.

## Experience

| Check | Verified |
|---|---|
| Every route has loading, empty, no-results, error and unauthorised states | ☐ |
| Full purchase path works on a real mid-tier phone over 4G | ☐ |
| Full purchase path is keyboard-navigable end to end | ☐ |
| Transactional emails land in the inbox, not spam | ☐ |

> **Email needs SPF, DKIM and DMARC on the sending domain before launch.** Mail
> from an unverified domain lands in spam, and the client blames the site rather
> than the DNS.

## Operations

| Check | Verified |
|---|---|
| CI green: lint, typecheck, test, build, migrations, bundle budget | ☐ |
| Backups running | ☐ |
| **One restore actually performed, and the time it took recorded** | ☐ |
| Uptime monitor hitting `/health`, alerting somewhere a human reads | ☐ |
| Error tracker receiving events, with a release tagged | ☐ |
| `RUNBOOK.md` contacts filled in | ☐ |
| `.env.example` complete for both packages | ☐ |

> **An untested backup is a hope.** Restore once into a scratch database, note
> how long it took, and write that number in `RUNBOOK.md`. The time to discover a
> broken backup is not during an incident.

## Legal and commercial

| Check | Verified |
|---|---|
| Privacy, Terms, Returns, Delivery and Allergen pages published and **accurate** | ☐ |
| Real contact details replace the `+971-XXX-XXXX` placeholders | ☐ |
| Business identity and a contact route visible in the footer | ☐ |
| Tax invoice generation verified against a real order | ☐ |

> **The policy pages are drafted, not lawyered.** They describe how the system
> actually behaves — the 24-hour reporting window, free delivery over AED 150,
> VAT-inclusive pricing, cancellation before baking starts. **Those are business
> decisions inferred from the code and each needs confirming.**

---

## Setting up the monitor

`GET /health` returns:

```json
{ "status": "ok", "db": "up", "dbLatencyMs": 3,
  "release": "abc1234", "uptimeSeconds": 8412 }
```

- Alert on a non-200, or on `status != "ok"`
- **Check every 60s from at least two regions** — one region flapping is usually
  the region, not the app
- Alert to somewhere a human actually reads. An alert nobody sees is not
  monitoring, and a channel everyone has muted is worse than none
- `dbLatencyMs` climbing is the early warning; it moves before anything fails

The endpoint is excluded from rate limiting, so a monitor cannot lock itself out.

---

## Known gaps at launch

Not blockers, but decide each deliberately rather than discovering them later.

- **Payments are not built.** Cash and card on collection or delivery only.
  Online card payment is planned (B7), and the UAE tax invoice — TRN, VAT line,
  sequential numbering — comes with it.
- **No email verification.** Anyone can type any address at checkout.
- **CSP allows `unsafe-inline` on scripts.** Removing it needs nonce plumbing
  through the Next document.
- **Legacy order numbers are sequential.** Orders placed before migration 004
  keep `FL1001`-style numbers; the tracking rate limit bounds their exposure
  until they age out.
- **No Arabic.** The mechanism is not in place either — this is a UAE storefront,
  so plan for it rather than treating it as optional.
