import { hash } from 'bcrypt';
import { performance } from 'node:perf_hooks';
import { BcryptPasswordHasher } from './BcryptPasswordHasher';

const COST = 12;

async function medianDuration(action: () => Promise<unknown>): Promise<number> {
  const durations: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    const start = performance.now();
    await action();
    durations.push(performance.now() - start);
  }
  return durations.sort((a, b) => a - b)[1] ?? 0;
}

describe('BcryptPasswordHasher', () => {
  let hasher: BcryptPasswordHasher;
  let storedHash: string;

  beforeAll(async () => {
    hasher = await BcryptPasswordHasher.create(COST);
    storedHash = await hash('senha-ficticia', COST);
  });

  it('confirma a senha correta', async () => {
    await expect(hasher.verify('senha-ficticia', storedHash)).resolves.toBe(
      true,
    );
  });

  it('recusa a senha errada', async () => {
    await expect(hasher.verify('outra-senha', storedHash)).resolves.toBe(false);
  });

  it('não ignora espaços na senha', async () => {
    await expect(hasher.verify(' senha-ficticia', storedHash)).resolves.toBe(
      false,
    );
  });

  it('recusa quando não há hash (CPF inexistente), comparando com o hash fictício', async () => {
    await expect(hasher.verify('senha-ficticia', null)).resolves.toBe(false);
  });

  it('leva tempo equivalente com e sem hash cadastrado', async () => {
    const withHash = await medianDuration(() =>
      hasher.verify('senha-errada', storedHash),
    );
    const withoutHash = await medianDuration(() =>
      hasher.verify('senha-errada', null),
    );

    expect(withoutHash / withHash).toBeGreaterThan(0.5);
    expect(withoutHash / withHash).toBeLessThan(2);
  }, 20_000);
});
