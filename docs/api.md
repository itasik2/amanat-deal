# API sketch

Base path: `/api/v1`.

## Authorization

Private deal endpoints require an active `amanat_session` created by phone/OTP authentication.

The API uses a global NestJS `ValidationPipe` with whitelisting and rejection of undeclared DTO fields. Browser CORS is restricted to the configured `WEB_APP_URL` and `ADMIN_APP_URL` origins instead of reflecting arbitrary origins.

- Deal access is resolved from `sellerId` / `buyerId` on the server.
- Buyer/seller role is never trusted from the browser for protected actions.
- Buyer-only actions include mock funding, delivery confirmation and receipt confirmation.
- Seller-only actions include shipment registration.
- Evidence and dispute endpoints are available only to authenticated participants of that deal.
- Evidence uploader role and dispute actor role are overwritten with the authenticated participant role on the server.
- Public invitation preview remains intentionally limited; full details and claiming require the phone-bound authenticated recipient.

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

### Inspection timeout automation

When delivery starts the inspection window, `inspectionEndsAt` is persisted on the deal.

- Participant reads reconcile an expired `INSPECTION` deal before returning it, so an overdue deal cannot remain interactive merely because the background scheduler is delayed.
- `GET /internal/automation/inspection-expirations` reconciles overdue inspection deals in batches and requires `Authorization: Bearer <CRON_SECRET>`.
- The Vercel API project registers a daily production cron as a Hobby-compatible backstop. On a plan that supports minute-level cron frequency, the schedule can be tightened without changing domain logic.
- Auto-completion is conditional on the deal still being in `INSPECTION`, so a concurrent `PROBLEM_REPORTED` transition prevents release.
- Auto-completion records `inspection.expired`, marks the deal `COMPLETED`, and changes the mock payment from `FUNDS_SECURED` to `RELEASED`.
- Manual buyer confirmation now also marks the mock payment `RELEASED`.

For `EXTENDED` protection, missing receipt evidence can block early manual confirmation, but it does not let a silent buyer hold the deal forever after the agreed inspection deadline.

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
- `POST /deals/:id/evidence` — multipart upload (`file`, `kind`, optional `note`). The uploader role is derived from the authenticated deal participant on the server.
- `GET /deals/:id/evidence/:evidenceId/file` — open/download stored evidence.

The API computes SHA-256 on the server. Evidence uses the `StorageProvider` abstraction: Cloudinary is selected when its credentials are configured, while local storage is intended only for development or a host with an explicitly persistent volume. On Vercel/serverless, the API refuses local evidence writes when no persistent storage is configured instead of pretending that an ephemeral file is durable. `GET /health` reports the active evidence-storage readiness/mode. Internal storage keys are not returned in normal evidence JSON responses.

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
