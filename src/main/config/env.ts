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

const GENERATED_SECRETS = new Set([
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'CPF_HMAC_SECRET',
]);

const databaseUrlSchema = z.string().transform((value, context) => {
  const check = checkDatabaseUrl(value, VERIFIED_SSL_MODES);
  if (!check.valid) {
    context.addIssue({ code: 'custom', message: check.problem });
    return z.NEVER;
  }
  return { url: value, schema: check.schema };
});

function pemSchema(label: 'PRIVATE KEY' | 'PUBLIC KEY') {
  return z.string().transform((value, context) => {
    const pem = value.replace(/\\n/g, '\n').trim();
    if (
      !pem.startsWith(`-----BEGIN ${label}-----`) ||
      !pem.endsWith(`-----END ${label}-----`)
    ) {
      context.addIssue({
        code: 'custom',
        message: `deve ser uma chave PEM do tipo ${label}`,
      });
      return z.NEVER;
    }
    return pem;
  });
}

function positiveInteger(fallback: number) {
  return z.coerce.number().int().positive().default(fallback);
}

const databaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: databaseUrlSchema,
});

const envSchema = databaseEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  JWT_PRIVATE_KEY: pemSchema('PRIVATE KEY'),
  JWT_PUBLIC_KEY: pemSchema('PUBLIC KEY'),
  JWT_ISSUER: z.string().min(1).default('fiap-school-api'),
  JWT_AUDIENCE: z.string().min(1).default('fiap-school-mobile'),
  ACCESS_TOKEN_TTL_SECONDS: positiveInteger(900),
  REFRESH_TOKEN_TTL_SECONDS: positiveInteger(2_592_000),
  BCRYPT_COST: z.coerce.number().int().min(12).default(12),
  CPF_HMAC_SECRET: z.string().min(32),
});

export type LogLevel = (typeof LOG_LEVELS)[number];

export type DatabaseEnv = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  database: Readonly<{ url: string; schema: string }>;
}>;

export type AuthEnv = Readonly<{
  privateKeyPem: string;
  publicKeyPem: string;
  issuer: string;
  audience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  bcryptCost: number;
  cpfHmacSecret: string;
}>;

export type Env = DatabaseEnv &
  Readonly<{
    port: number;
    logLevel: LogLevel;
    auth: AuthEnv;
  }>;

function describeIssue(issue: z.core.$ZodIssue): string {
  const name = issue.path.join('.');
  return issue.code === 'custom'
    ? `${name} ${issue.message}`
    : `${name} ausente ou inválida`;
}

function parse<S extends z.ZodType>(
  schema: S,
  source: NodeJS.ProcessEnv,
): z.output<S> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const { issues } = result.error;
  const details = issues.map(describeIssue).join('; ');
  const needsGeneratedSecrets = issues.some(issue =>
    GENERATED_SECRETS.has(String(issue.path[0])),
  );
  const hint = needsGeneratedSecrets
    ? ' Gere as chaves com: yarn keys:generate <arquivo .env>.'
    : '';
  throw new Error(`Variáveis de ambiente inválidas: ${details}.${hint}`);
}

export function loadDatabaseEnv(source: NodeJS.ProcessEnv): DatabaseEnv {
  const data = parse(databaseEnvSchema, source);
  return { nodeEnv: data.NODE_ENV, database: data.DATABASE_URL };
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const data = parse(envSchema, source);
  return {
    nodeEnv: data.NODE_ENV,
    database: data.DATABASE_URL,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    auth: {
      privateKeyPem: data.JWT_PRIVATE_KEY,
      publicKeyPem: data.JWT_PUBLIC_KEY,
      issuer: data.JWT_ISSUER,
      audience: data.JWT_AUDIENCE,
      accessTokenTtlSeconds: data.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: data.REFRESH_TOKEN_TTL_SECONDS,
      bcryptCost: data.BCRYPT_COST,
      cpfHmacSecret: data.CPF_HMAC_SECRET,
    },
  };
}
