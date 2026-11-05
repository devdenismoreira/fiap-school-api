import {
  DEFAULT_SEED_SOURCE_PATH,
  describeSeedTarget,
  loadSeedEnv,
} from './seedEnv';

const DATABASE_URL =
  'postgresql://usuario:senha-secreta@pooler.exemplo.com:6543/postgres?schema=fiap_school_test&sslmode=verify-full';

describe('loadSeedEnv', () => {
  it('usa o caminho padrão da fonte e o custo 12 do bcrypt', () => {
    expect(loadSeedEnv({ NODE_ENV: 'test', DATABASE_URL }, [])).toEqual({
      nodeEnv: 'test',
      database: { url: DATABASE_URL, schema: 'fiap_school_test' },
      sourcePath: DEFAULT_SEED_SOURCE_PATH,
      bcryptCost: 12,
    });
  });

  it('lê SEED_SOURCE_PATH e BCRYPT_COST informados', () => {
    const env = loadSeedEnv(
      {
        NODE_ENV: 'development',
        DATABASE_URL,
        SEED_SOURCE_PATH: '/dados/responsaveis.json',
        BCRYPT_COST: '13',
      },
      [],
    );

    expect(env.sourcePath).toBe('/dados/responsaveis.json');
    expect(env.bcryptCost).toBe(13);
  });

  it.each(['11', 'abc'])('recusa BCRYPT_COST=%s', cost => {
    expect(() =>
      loadSeedEnv(
        { NODE_ENV: 'development', DATABASE_URL, BCRYPT_COST: cost },
        [],
      ),
    ).toThrow('BCRYPT_COST');
  });

  it('não roda em produção sem --force', () => {
    expect(() =>
      loadSeedEnv({ NODE_ENV: 'production', DATABASE_URL }, []),
    ).toThrow('--force');
  });

  it('roda em produção com --force', () => {
    expect(
      loadSeedEnv({ NODE_ENV: 'production', DATABASE_URL }, ['--force'])
        .nodeEnv,
    ).toBe('production');
  });

  it('herda a validação da DATABASE_URL', () => {
    expect(() =>
      loadSeedEnv(
        {
          NODE_ENV: 'development',
          DATABASE_URL: DATABASE_URL.replace('verify-full', 'require'),
        },
        [],
      ),
    ).toThrow('sslmode=verify-full');
  });
});

describe('describeSeedTarget', () => {
  it('mostra host e schema, sem usuário nem senha', () => {
    const description = describeSeedTarget(
      loadSeedEnv({ NODE_ENV: 'test', DATABASE_URL }, []),
    );

    expect(description).toBe(
      'host pooler.exemplo.com:6543, schema fiap_school_test',
    );
    expect(description).not.toContain('usuario');
    expect(description).not.toContain('senha-secreta');
  });
});
