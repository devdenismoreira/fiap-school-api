import { loadSeedSource } from '../../src/infra/database/seed/seedSource';
import type {
  SeedGuardian,
  SeedSource,
} from '../../src/infra/database/seed/seedSource';
import { DEFAULT_SEED_SOURCE_PATH } from '../../src/main/config/seedEnv';

export function loadSourceForTests(): SeedSource {
  return loadSeedSource(
    process.env.SEED_SOURCE_PATH ?? DEFAULT_SEED_SOURCE_PATH,
  );
}

export function withoutCredentials(guardian: SeedGuardian) {
  return {
    id: guardian.id,
    primeiroNome: guardian.primeiroNome,
    sobrenome: guardian.sobrenome,
    alunos: guardian.alunos.map(
      ({ agenda: _agenda, boletim: _boletim, ...student }) => student,
    ),
  };
}
