import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const root = process.cwd();

for (const file of ['.env', '.env.local']) {
  const envPath = resolve(root, file);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const command = process.argv[2];
const schema = 'packages/database/prisma/schema.prisma';

const commands = {
  generate: ['generate', '--schema', schema],
  migrate: ['migrate', 'dev', '--schema', schema],
  deploy: ['migrate', 'deploy', '--schema', schema],
  reset: ['migrate', 'reset', '--schema', schema],
  studio: ['studio', '--schema', schema]
};

const args = commands[command];
if (!args) {
  console.error(`Unknown Prisma command: ${command ?? '(missing)'}`);
  process.exit(1);
}

if (command !== 'generate' && !process.env.DATABASE_URL) {
  console.error('\nDATABASE_URL is not set.');
  console.error(`Expected it in ${resolve(root, '.env')}, .env.local, or the process environment.`);
  process.exit(1);
}

if (command !== 'generate' && !process.env.DIRECT_URL) {
  console.error('\nDIRECT_URL is not set.');
  console.error('For Neon, use the non-pooled connection string for DIRECT_URL.');
  console.error('For a local PostgreSQL database, DIRECT_URL may be the same as DATABASE_URL.');
  process.exit(1);
}

const result = spawnSync('prisma', args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
