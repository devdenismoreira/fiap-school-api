import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { findTestDatabaseProblem } from '../support/testDatabaseGuard';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const ENV_TEST_PATH = resolve(PROJECT_ROOT, '.env.test');

function runYarn(args: readonly string[]): void {
  execFileSync('yarn', ['-s', ...args], {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: 'inherit',
  });
}

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

  runYarn(['prisma', 'migrate', 'deploy']);
  runYarn(['db:seed']);
}
