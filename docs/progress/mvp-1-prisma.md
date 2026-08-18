# MVP-1 progress: Prisma persistence

Completed in `main`:

- Added `PrismaService` and `PrismaModule` in `apps/api/src/modules/prisma`.
- Wired `PrismaModule` into `DealsModule`.
- Replaced in-memory deal storage in `DealsService` with Prisma/PostgreSQL calls.
- Persisted deal events in `DealEvent`.
- Persisted mock escrow payments in `Payment`.
- Persisted shipment/delivery data in `Delivery`.
- Added an initial SQL migration under `packages/database/prisma/migrations`.
- Updated API docs and README with local Prisma setup commands.

Manual verification still needed in Codespace because this chat runtime cannot reach GitHub/npm from the container.

Suggested local check:

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run build -w apps/api
npm run dev -w apps/api
```

Then test:

```bash
curl -X POST http://localhost:4000/api/v1/deals \
  -H 'Content-Type: application/json' \
  -d '{"title":"Тестовая сделка","description":"Проверочная сделка для Prisma persistence","category":"GOODS","amountKzt":100000,"inspectionHours":48}'
```

After API restart, `GET /api/v1/deals` should still return the created deal.
