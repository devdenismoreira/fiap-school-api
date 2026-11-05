import { checkDatabaseUrl } from '../../src/main/config/databaseUrl';

const GUARDED_VARIABLES = ['DATABASE_URL', 'DIRECT_URL'] as const;
const TEST_SCHEMA_SUFFIX = '_test';

export function findTestDatabaseProblem(
  env: NodeJS.ProcessEnv,
): string | undefined {
  for (const name of GUARDED_VARIABLES) {
    const value = env[name];
    if (!value) {
      return `${name} não está definida no .env.test`;
    }
    const check = checkDatabaseUrl(value);
    if (!check.valid) {
      return `${name} ${check.problem}`;
    }
    if (!check.schema.endsWith(TEST_SCHEMA_SUFFIX)) {
      return `${name} aponta para o schema "${check.schema}", que não termina em ${TEST_SCHEMA_SUFFIX}`;
    }
  }
  return undefined;
}
