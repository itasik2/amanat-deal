# API sketch

Base path: `/api/v1`.

## Deals

- `POST /deals` — create deal.
- `GET /deals` — list deals.
- `GET /deals/:id` — get deal.
- `POST /deals/:id/accept` — buyer accepts terms.
- `POST /deals/:id/mock-payment` — mock escrow funding, moves deal to `WAITING_SHIPMENT`.
- `POST /deals/:id/shipment` — seller adds shipment data and moves deal to `SHIPPED`.
- `POST /deals/:id/mark-delivered` — marks delivery, starts inspection.
- `POST /deals/:id/confirm-receipt` — releases mock funds to seller and completes deal.
- `POST /deals/:id/report-problem` — stops normal flow and moves deal to `PROBLEM_REPORTED`.
- `GET /deals/:id/events` — immutable event timeline.

## Admin

- `GET /admin/deals` — later: list pilot deals for operators.
- `GET /admin/deals/:id` — later: inspect one deal.

## Webhooks, later

- `POST /webhooks/bank`
- `POST /webhooks/delivery`

## Persistence

The API uses `PrismaService` from `apps/api/src/modules/prisma` and the shared Prisma schema from `packages/database/prisma/schema.prisma`.

Before running the API locally:

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The current MVP still uses mock escrow, but deals, deliveries, payments and events are now designed to persist in PostgreSQL instead of in-memory maps.
