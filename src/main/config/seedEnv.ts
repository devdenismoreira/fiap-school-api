import { z } from 'zod';
import { loadEnv, type Env } from './env';

export const DEFAULT_SEED_SOURCE_PATH =
  '../FiapSchoolMobile/src/data/datasources/local/responsaveis.json';

const seedSchema = z.object({
  SEED_SOURCE_PATH: z.string().min(1).default(DEFAULT_SEED_SOURCE_PATH),
  BCRYPT_COST: z.coerce.number().int().min(12).default(12),
});

export type SeedEnv = Readonly<{
  nodeEnv: Env['nodeEnv'];
  database: Env['database'];
  sourcePath: string;
  bcryptCost: number;
}>;

export function loadSeedEnv(
  source: NodeJS.ProcessEnv,
  args: readonly string[],
): SeedEnv {
  const env = loadEnv(source);
  const result = seedSchema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map(issue => issue.path.join('.'));
    throw new Error(
      `Variáveis de ambiente inválidas: ${names.join(', ')} ausente ou inválida (BCRYPT_COST mínimo 12).`,
    );
  }
  if (env.nodeEnv === 'production' && !args.includes('--force')) {
    throw new Error(
      'O seed apaga e regrava os dados: com NODE_ENV=production, rode com --force.',
    );
  }
  return {
    nodeEnv: env.nodeEnv,
    database: env.database,
    sourcePath: result.data.SEED_SOURCE_PATH,
    bcryptCost: result.data.BCRYPT_COST,
  };
}

export function describeSeedTarget(env: SeedEnv): string {
  return `host ${new URL(env.database.url).host}, schema ${env.database.schema}`;
}
