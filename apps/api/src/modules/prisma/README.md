# Prisma module

`PrismaModule` exposes `PrismaService` as a global NestJS provider.

The schema lives in `packages/database/prisma/schema.prisma` so API, admin and future workers can share one database contract.

Local setup:

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
