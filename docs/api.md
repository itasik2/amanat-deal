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

## Evidence

- `GET /deals/:id/evidence` — list deal evidence and metadata.
- `POST /deals/:id/evidence` — multipart upload (`file`, `kind`, `uploaderRole`, optional `note`).
- `GET /deals/:id/evidence/:evidenceId/file` — open/download stored evidence.

The API computes SHA-256 on the server. The pilot stores files through `StorageProvider`; the default implementation writes to local `.data/evidence`, while the business layer is prepared for a later S3/R2 provider.

## Dispute settlement channel

Available for deals in `PROBLEM_REPORTED` or `WAITING_LEGAL_RESOLUTION`.

- `GET /deals/:id/dispute/messages` — immutable negotiation history.
- `POST /deals/:id/dispute/messages` — add a buyer/seller message and optionally attach evidence.
- `POST /deals/:id/dispute/proposals` — propose full refund, partial refund, release to seller, or custom settlement.
- `POST /deals/:id/dispute/proposals/:proposalId/respond` — accept or reject a proposal.

Acceptance records a settlement agreement in the audit trail. It does **not** move money by itself. Release/refund will remain a separate backend/provider command.

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

The current MVP still uses mock escrow, but deals, deliveries, payments, evidence, dispute messages and events persist in PostgreSQL instead of in-memory maps.
