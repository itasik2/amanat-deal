# Amanat Deal

API-first MVP for a protected deal flow: seller creates a deal, buyer accepts, funds are secured by a mock escrow provider, seller ships, buyer confirms receipt or the inspection period ends, and the deal is completed.

## Product principle

The platform is not a court, not an insurer and not a bookmaker. It fixes terms, records events and evidence, and prepares the system for a future bank/escrow integration.

## Current MVP scope

- Universal protected deal category model.
- Mock escrow instead of real money.
- Deal state machine.
- PostgreSQL/Prisma persistence.
- API-first backend.
- Web/PWA shell.
- Admin shell.
- Evidence and legal docs planned as separate milestones.

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

1. Seller creates a deal.
2. Buyer accepts the deal.
3. Mock escrow marks funds as secured.
4. Seller adds shipment data.
5. Delivery is marked as delivered.
6. Inspection period starts.
7. Buyer confirms receipt or reports a problem.
8. Deal completes or moves to problem/legal flow.

## Important warning

Real payments must not be connected until the banking, tax and legal architecture is validated. Shocking, yes: money is less forgiving than a broken CSS class.
