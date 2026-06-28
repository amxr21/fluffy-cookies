# Fluffy 🍪

Handcrafted cookies and sweet specialty coffees — freshly made every day for
pickup or events. Al Ain, UAE.

This repository contains two packages:

| Package | Stack |
|---|---|
| `frontend/` | Next.js · TypeScript · Tailwind CSS · GSAP |
| `backend/` | Node.js · Express · MySQL |

## Getting started

### Frontend
```bash
cd frontend
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

### Backend
```bash
cd backend
pnpm install
cp .env.example .env         # then fill in the values
pnpm migrate                 # create database tables
pnpm seed                    # load the menu
pnpm dev                     # http://localhost:4000
```

> The backend can run without a database for development/testing by setting
> `USE_FILE_DATA=true`.

## Environment

- **Frontend** needs the backend URL and a Google client ID (see
  `frontend/.env.example`).
- **Backend** needs MySQL credentials, a Google client ID, and a JWT secret (see
  `backend/.env.example`).

## License

Private project. All rights reserved.
