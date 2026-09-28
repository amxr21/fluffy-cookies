# Fluffy 🍪

Handcrafted cookies and sweet specialty coffees — freshly made every day for
pickup or events. Al Ain, UAE.

This repository is the storefront. Everything commercial — the menu, stock,
customers, carts, favourites and orders — lives in the **admin dashboard**, a
separate product; the storefront reaches it only through its own same-origin
bridge at `/api/storefront`.

| Package | Stack |
|---|---|
| `frontend/` | Next.js · TypeScript · Tailwind CSS · GSAP |

## Getting started

```bash
pnpm install
cp frontend/.env.example frontend/.env.local   # then fill in the values
pnpm dev                                       # http://localhost:3000
```

The storefront needs a running dashboard backend to show a menu. Point
`API_ORIGIN` at it and set `DASHBOARD_API_KEY` to an integration key from the
dashboard's API keys page, selecting STOREFRONT audience and public scopes.
Without them the menu shows as unavailable. Set `DASHBOARD_BRANCH_ID` when the
dashboard has more than one selling branch.

Fluffy's menu is loaded into the dashboard with
`scripts/seed-dashboard-menu.sql` (run against the dashboard's database).
Review configuration scripts before applying them to the intended database;
local QA settings are not automatically applied in production.

## Commercial behavior

The dashboard owns live prices, stock, discounts, VAT and delivery fees through
shared quote/checkout pricing. Fluffy prices include 5% VAT. Pickup is free;
delivery zones charge AED 15 (Al Ain), AED 25 (Abu Dhabi), AED 30 (Dubai/Sharjah),
or AED 40 (Northern Emirates), with free delivery from AED 150 of merchandise
after discounts. Zones are generic dashboard records; enable
`store.deliveryZonesEnabled` and install the approved Fluffy configuration.
The storefront supports Google sign-in, guest-cart merge, promo preview, cash
orders, order history and tracking. Online card payments are not implemented.

## Deployment

Production runs on Hostinger/Coolify with Traefik: MySQL, dashboard API, dashboard
admin UI, and this storefront. There is no active legacy API in this repository.
See [integration setup](HOW-TO-CONNECT-ADMIN-DASHBOARD.md),
[runbook](RUNBOOK.md), [launch checks](LAUNCH.md), and [security posture](SECURITY.md).
Deployment, key replacement and database changes are separate operator actions.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test                                   # unit tests
pnpm build && pnpm --filter ./frontend test:e2e   # smoke suite, mock dashboard
```

## Environment

See `frontend/.env.example`. `API_ORIGIN` and `DASHBOARD_API_KEY` are
server-only and read at request time; `NEXT_PUBLIC_*` values are fixed at build
time, so changing one means a rebuild.
Configure `NEXT_PUBLIC_SITE_URL` as the canonical HTTPS storefront origin before
building. Keep integration credentials out of public variables and browser code.

## License

Private project. All rights reserved.
