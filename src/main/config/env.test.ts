import { generateKeyPairSync } from 'node:crypto';
import { loadDatabaseEnv, loadEnv } from './env';

const DATABASE_URL =
  'postgresql://usuario:senha-ficticia@localhost:6543/postgres?schema=fiap_school&sslmode=verify-full&sslrootcert=certs/supabase-ca.crt';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CPF_HMAC_SECRET = 'segredo-ficticio-com-mais-de-32-caracteres';

function validSource(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DATABASE_URL,
    JWT_PRIVATE_KEY: privateKey,
    JWT_PUBLIC_KEY: publicKey,
    CPF_HMAC_SECRET,
    ...overrides,
  };
}

function errorMessageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Era esperado um erro');
}

describe('loadEnv', () => {
  it('carrega as variáveis e aplica os padrões da spec 04', () => {
    expect(loadEnv(validSource())).toEqual({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      database: { url: DATABASE_URL, schema: 'fiap_school' },
      auth: {
        privateKeyPem: privateKey.trim(),
        publicKeyPem: publicKey.trim(),
        issuer: 'fiap-school-api',
        audience: 'fiap-school-mobile',
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        bcryptCost: 12,
        cpfHmacSecret: CPF_HMAC_SECRET,
      },
    });
  });

  it('lê os valores informados', () => {
    const env = loadEnv(
      validSource({
        NODE_ENV: 'production',
        PORT: '8080',
        LOG_LEVEL: 'warn',
        JWT_ISSUER: 'emissor',
        JWT_AUDIENCE: 'publico',
        ACCESS_TOKEN_TTL_SECONDS: '600',
        REFRESH_TOKEN_TTL_SECONDS: '86400',
        BCRYPT_COST: '13',
      }),
    );

    expect(env.port).toBe(8080);
    expect(env.logLevel).toBe('warn');
    expect(env.auth).toMatchObject({
      issuer: 'emissor',
      audience: 'publico',
      accessTokenTtlSeconds: 600,
      refreshTokenTtlSeconds: 86400,
      bcryptCost: 13,
    });
  });

  it('aceita a chave PEM numa linha só, com \\n escrito', () => {
    const escaped = privateKey.trim().replace(/\n/g, '\\n');

    expect(
      loadEnv(validSource({ JWT_PRIVATE_KEY: escaped })).auth.privateKeyPem,
    ).toBe(privateKey.trim());
  });

  it('não sobe sem DATABASE_URL', () => {
    expect(() => loadEnv(validSource({ DATABASE_URL: undefined }))).toThrow(
      'DATABASE_URL ausente ou inválida',
    );
  });

  it('não sobe sem NODE_ENV', () => {
    expect(() => loadEnv(validSource({ NODE_ENV: undefined }))).toThrow(
      'NODE_ENV ausente ou inválida',
    );
  });

  it.each(['abc', '0', '70000', '30.5'])('recusa PORT=%s', port => {
    expect(() => loadEnv(validSource({ PORT: port }))).toThrow(
      'PORT ausente ou inválida',
    );
  });

  it('recusa URL do banco sem sslmode, com mensagem clara e sem mostrar o valor', () => {
    const urlWithoutTls =
      'postgresql://usuario:senha-secreta@pooler.exemplo.com:6543/postgres?schema=fiap_school';

    const message = errorMessageOf(() =>
      loadEnv(
        validSource({ NODE_ENV: 'production', DATABASE_URL: urlWithoutTls }),
      ),
    );

    expect(message).toBe(
      'Variáveis de ambiente inválidas: DATABASE_URL deve exigir TLS com sslmode=verify-full.',
    );
    expect(message).not.toContain('senha-secreta');
    expect(message).not.toContain('pooler.exemplo.com');
  });

  it.each(['require', 'verify-ca', 'disable'])(
    'recusa sslmode=%s na URL do banco, porque não garante a validação do certificado',
    sslmode => {
      expect(() =>
        loadEnv(
          validSource({
            DATABASE_URL: `postgresql://usuario:senha@localhost:6543/postgres?schema=fiap_school&sslmode=${sslmode}`,
          }),
        ),
      ).toThrow('DATABASE_URL deve exigir TLS com sslmode=verify-full');
    },
  );

  it('recusa URL do banco sem schema', () => {
    expect(() =>
      loadEnv(
        validSource({
          DATABASE_URL:
            'postgresql://usuario:senha@localhost:6543/postgres?sslmode=verify-full',
        }),
      ),
    ).toThrow('DATABASE_URL deve indicar o schema');
  });

  it('sem as chaves geradas, explica como gerá-las e não mostra valores', () => {
    const message = errorMessageOf(() =>
      loadEnv(
        validSource({
          JWT_PRIVATE_KEY: undefined,
          JWT_PUBLIC_KEY: undefined,
          CPF_HMAC_SECRET: undefined,
        }),
      ),
    );

    expect(message).toContain('JWT_PRIVATE_KEY ausente ou inválida');
    expect(message).toContain('JWT_PUBLIC_KEY ausente ou inválida');
    expect(message).toContain('CPF_HMAC_SECRET ausente ou inválida');
    expect(message).toContain('yarn keys:generate');
  });

  it('recusa chave pública no lugar da privada, sem mostrar a chave', () => {
    const message = errorMessageOf(() =>
      loadEnv(validSource({ JWT_PRIVATE_KEY: publicKey })),
    );

    expect(message).toContain(
      'JWT_PRIVATE_KEY deve ser uma chave PEM do tipo PRIVATE KEY',
    );
    expect(message).not.toContain('BEGIN PUBLIC KEY');
  });

  it('recusa CPF_HMAC_SECRET com menos de 32 caracteres', () => {
    expect(() => loadEnv(validSource({ CPF_HMAC_SECRET: 'curto' }))).toThrow(
      'CPF_HMAC_SECRET ausente ou inválida',
    );
  });

  it('recusa BCRYPT_COST abaixo de 12', () => {
    expect(() => loadEnv(validSource({ BCRYPT_COST: '10' }))).toThrow(
      'BCRYPT_COST ausente ou inválida',
    );
  });

  it('relata todos os problemas de uma vez', () => {
    const message = errorMessageOf(() => loadEnv({ PORT: 'abc' }));

    expect(message).toContain('NODE_ENV');
    expect(message).toContain('PORT');
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_PRIVATE_KEY');
  });
});

describe('loadDatabaseEnv', () => {
  it('carrega só o ambiente e o banco, sem exigir as chaves', () => {
    expect(loadDatabaseEnv({ NODE_ENV: 'test', DATABASE_URL })).toEqual({
      nodeEnv: 'test',
      database: { url: DATABASE_URL, schema: 'fiap_school' },
    });
  });

  it('aplica a mesma validação da URL do banco', () => {
    expect(() =>
      loadDatabaseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: DATABASE_URL.replace('verify-full', 'require'),
      }),
    ).toThrow('sslmode=verify-full');
  });
});
