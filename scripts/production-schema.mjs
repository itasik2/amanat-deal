import { PrismaClient } from '@prisma/client';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Preview builds must never run migrations against shared production credentials.
if (process.env.VERCEL_ENV !== 'production') process.exit(0);
const prisma = new PrismaClient();
try {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
  const names = new Set(tables.map(row => row.tablename));
  const required = ['User', 'UserSession', 'DealInvitation', 'PhoneOtpChallenge'];
  console.log('[schema] missing auth tables:', JSON.stringify(required.filter(name => !names.has(name))));
  if (!names.has('_prisma_migrations')) throw new Error('Migration history is missing; inspect schema and baseline explicitly. No automatic reset or db push.');
  const applied = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  if (applied.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Unresolved failed migration requires inspection');
  const complete = new Set(applied.filter(row => row.finished_at).map(row => row.migration_name));
  const pending = readdirSync('packages/database/prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory() && !complete.has(entry.name)).map(entry => entry.name).sort();
  console.log('[schema] pending migrations:', JSON.stringify(pending));
  for (const migration of pending) {
    const sql = readFileSync(`packages/database/prisma/migrations/${migration}/migration.sql`, 'utf8');
    if (/\b(DROP\s+(TABLE|COLUMN|TYPE)|TRUNCATE|DELETE\s+FROM)\b/i.test(sql)) throw new Error(`Destructive migration requires a separate reviewed rollout: ${migration}`);
  }
  await prisma.$disconnect();
  if (pending.length) {
    const result = spawnSync(process.execPath, ['scripts/prisma.mjs', 'deploy'], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) throw new Error('Production migration failed; deployment stopped');
  }
  await prisma.phoneOtpChallenge.findFirst({ select: { id: true } });
  console.log('[schema] phone OTP table verified');
} catch (error) {
  // Prisma diagnostics can contain connection details. Keep build output safe.
  console.error('[schema] deployment blocked:', error?.code || (error instanceof Error && !error.name.startsWith('Prisma') ? error.message : 'database schema check failed'));
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
