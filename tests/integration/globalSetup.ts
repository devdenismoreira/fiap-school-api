import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { findTestDatabaseProblem } from '../support/testDatabaseGuard';

const ENV_TEST_PATH = resolve(__dirname, '..', '..', '.env.test');

export default function globalSetup(): void {
  if (!existsSync(ENV_TEST_PATH)) {
    throw new Error(
      'Testes de integração abortados: crie o .env.test a partir do .env.example, apontando para o schema fiap_school_test.',
    );
  }
  Object.assign(process.env, parseEnv(readFileSync(ENV_TEST_PATH, 'utf8')));

  const problem = findTestDatabaseProblem(process.env);
  if (problem) {
    throw new Error(`Testes de integração abortados: ${problem}.`);
  }
}
