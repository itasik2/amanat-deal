# API sketch

Base path: `/api/v1`.

## Deals

- `POST /deals` — create deal. Optional `protectionPlan`: `BASIC` (default) or `EXTENDED`.
- `GET /deals` — list deals.
- `GET /deals/:id` — get deal.
- `POST /deals/:id/accept` — buyer accepts terms.
- `POST /deals/:id/mock-payment` — mock escrow funding, moves deal to `WAITING_SHIPMENT`.
- `POST /deals/:id/shipment` — seller adds shipment data and moves deal to `SHIPPED`.
- `POST /deals/:id/mark-delivered` — marks delivery, starts inspection.
- `POST /deals/:id/confirm-receipt` — releases mock funds to seller and completes deal.
- `POST /deals/:id/report-problem` — stops normal flow and moves deal to `PROBLEM_REPORTED`.
- `GET /deals/:id/events` — immutable event timeline.

### Protection plans

Every deal includes terms, event history, dispute channel and evidence collection.

- `BASIC` — standard protected deal flow and standard fee (`PLATFORM_FEE_PERCENT`, default 2%). Evidence checklist items are recommendations and do not block the flow.
- `EXTENDED` — enhanced protection flow with a stricter evidence checklist and a separate fee (`EXTENDED_PROTECTION_FEE_PERCENT`, default 3%). Required evidence blocks the protected transition until the relevant checklist stage is complete.

Evidence is not a paid extension by itself. The difference between plans is the level of required verification and guidance.

### Protection evidence checklist

- `GET /deals/:id/protection-checklist` — computed checklist for the deal category and protection plan.

The checklist is computed from `category + protectionPlan + EvidenceFile[]`; it does not require a separate database table. Current categories have different rules for goods, equipment, repairs, services and other deals.

For `EXTENDED` deals:

- `PRE_SHIPMENT` items must be satisfied before `POST /deals/:id/shipment`.
- `RECEIPT` items must be satisfied before `POST /deals/:id/confirm-receipt`.

For `BASIC` deals the same mechanism shows a recommended minimum but does not block transitions.

## Evidence

Evidence is part of every deal:

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

Acceptance records a settlement agreement in the audit trail. It does **not** move money by itself. Release/refund remains a separate backend/provider command.

### Optional paid dispute assistance

The negotiation channel itself is part of the deal. Amanat Deal assistance is a separate, optionally monetized service.

- `GET /deals/:id/dispute/assistance` — current assistance request/status.
- `POST /deals/:id/dispute/assistance/request` — request assistance for an active dispute.

The request does not charge money automatically. `quotedFeeKzt` is nullable so pricing can be quoted/approved separately before activation. Assistance can later cover evidence completeness checks, chronology/summary preparation and structured settlement support without making Amanat Deal the judge of the dispute.

## Admin

- `GET /admin/deals` — later: list pilot deals for operators.
- `GET /admin/deals/:id` — later: inspect one deal.

## Webhooks, later

- `POST /webhooks/bank`
- `POST /webhooks/delivery`

## Persistence

The API uses `PrismaService` from `apps/api/src/modules/prisma` and the shared Prisma schema from `packages/database/prisma/schema.prisma`.

For the current Neon-backed dev/staging setup, configure `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in `.env`, then run:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

A local Docker PostgreSQL remains possible by using the local URLs from `.env.example` and starting `docker compose up -d`.

The current MVP still uses mock escrow, but deals, deliveries, payments, evidence, dispute messages, dispute assistance requests and events persist in PostgreSQL instead of in-memory maps.
