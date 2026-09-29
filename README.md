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
dashboard's API keys page. Without them the menu shows as unavailable.

Fluffy's menu is loaded into the dashboard with
`scripts/seed-dashboard-menu.sql` (run against the dashboard's database).

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

## License

Private project. All rights reserved.
