import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { generateSecrets, mergeSecrets } from './envSecrets';

const VERSIONED_FILES = new Set(['.env.example']);

function main(target: string | undefined): void {
  if (!target) {
    throw new Error(
      'Informe o arquivo de destino: yarn keys:generate .env (ou .env.test).',
    );
  }
  if (VERSIONED_FILES.has(basename(target))) {
    throw new Error(
      `${target} vai para o git: as chaves só podem ir para .env ou .env.test.`,
    );
  }
  const content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const result = mergeSecrets(content, generateSecrets());
  writeFileSync(target, result.content, { mode: 0o600 });
  const added = result.added.join(', ') || 'nenhuma';
  const kept = result.kept.join(', ') || 'nenhuma';
  console.log(`${target}: adicionadas ${added}; mantidas ${kept}.`);
}

try {
  main(process.argv[2]);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Falha ao gerar as chaves.',
  );
  process.exitCode = 1;
}
