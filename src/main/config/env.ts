import { z } from 'zod';
import { checkDatabaseUrl, VERIFIED_SSL_MODES } from './databaseUrl';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

const databaseUrlSchema = z.string().transform((value, context) => {
  const check = checkDatabaseUrl(value, VERIFIED_SSL_MODES);
  if (!check.valid) {
    context.addIssue({ code: 'custom', message: check.problem });
    return z.NEVER;
  }
  return { url: value, schema: check.schema };
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  DATABASE_URL: databaseUrlSchema,
});

export type LogLevel = (typeof LOG_LEVELS)[number];

export type Env = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: LogLevel;
  database: Readonly<{ url: string; schema: string }>;
}>;

function describeIssue(issue: z.core.$ZodIssue): string {
  const name = issue.path.join('.');
  return issue.code === 'custom'
    ? `${name} ${issue.message}`
    : `${name} ausente ou inválida`;
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map(describeIssue).join('; ');
    throw new Error(`Variáveis de ambiente inválidas: ${details}.`);
  }
  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    logLevel: result.data.LOG_LEVEL,
    database: result.data.DATABASE_URL,
  };
}
