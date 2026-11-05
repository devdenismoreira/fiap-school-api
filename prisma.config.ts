import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { assertDatabaseUrl } from './src/main/config/databaseUrl';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const directUrl = process.env.DIRECT_URL;

if (directUrl !== undefined) {
  assertDatabaseUrl('DIRECT_URL', directUrl);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: directUrl,
  },
});
