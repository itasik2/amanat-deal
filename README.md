# Amanat Deal

API-first MVP for a protected deal flow: seller creates a deal, buyer accepts, funds are secured by a mock escrow provider, seller ships, buyer confirms receipt or the inspection period ends, and the deal is completed.

## Product principle

The platform is not a court, not an insurer and not a bookmaker. It fixes terms, records events and evidence, and prepares the system for a future bank/escrow integration.

## Current MVP scope

- Universal protected deal category model.
- Phone/OTP accounts with server sessions.
- Phone-bound counterparty invitations and per-deal buyer/seller roles.
- Server-side participant authorization for deal actions, evidence and disputes.
- Mock escrow instead of real money.
- Deal state machine with automatic inspection-timeout completion.
- PostgreSQL/Prisma persistence.
- Evidence uploads, SHA-256 audit data and protection checklists.
- Dispute messages, settlement proposals and optional assistance requests.
- API-first backend.
- Web/PWA shell.
- Admin shell.

## Monorepo layout

```text
apps/
  api/      NestJS API
  web/      Next.js PWA
  admin/    Next.js admin shell
packages/
  database/ Prisma schema and migrations
  shared/   shared TypeScript types
```

## Local start

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Services:

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`
- Web: `http://localhost:3000`
- Admin: `http://localhost:3001`

## First pilot path

1. User signs in by phone/OTP and creates a deal as buyer or seller.
2. The creator invites the counterparty by their phone number.
3. The invited account claims the invitation and both server-side roles are fixed.
4. Buyer runs the mock funding step.
5. Seller adds required evidence and shipment data.
6. Buyer confirms delivery and the inspection period starts.
7. Buyer confirms receipt, reports a problem before the deadline, or the inspection window expires.
8. On timeout the system completes the deal and releases the mock escrow status automatically; an active problem stops that path.

## Important warning

Real payments must not be connected until the banking, tax and legal architecture is validated. Shocking, yes: money is less forgiving than a broken CSS class.
