import { loadEnv } from './env';

const DATABASE_URL =
  'postgresql://usuario:senha-ficticia@localhost:6543/postgres?schema=fiap_school&sslmode=verify-full&sslrootcert=certs/supabase-ca.crt';

function errorMessageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Era esperado um erro');
}

describe('loadEnv', () => {
  it('carrega as variáveis e aplica os padrões', () => {
    expect(loadEnv({ NODE_ENV: 'development', DATABASE_URL })).toEqual({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      database: { url: DATABASE_URL, schema: 'fiap_school' },
    });
  });

  it('lê PORT e LOG_LEVEL informados', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      DATABASE_URL,
    });

    expect(env.port).toBe(8080);
    expect(env.logLevel).toBe('warn');
  });

  it('não sobe sem DATABASE_URL', () => {
    expect(() => loadEnv({ NODE_ENV: 'development' })).toThrow(
      'DATABASE_URL ausente ou inválida',
    );
  });

  it('não sobe sem NODE_ENV', () => {
    expect(() => loadEnv({ DATABASE_URL })).toThrow(
      'NODE_ENV ausente ou inválida',
    );
  });

  it.each(['abc', '0', '70000', '30.5'])('recusa PORT=%s', port => {
    expect(() =>
      loadEnv({ NODE_ENV: 'development', PORT: port, DATABASE_URL }),
    ).toThrow('PORT ausente ou inválida');
  });

  it('recusa URL do banco sem sslmode, com mensagem clara e sem mostrar o valor', () => {
    const urlWithoutTls =
      'postgresql://usuario:senha-secreta@pooler.exemplo.com:6543/postgres?schema=fiap_school';

    const message = errorMessageOf(() =>
      loadEnv({ NODE_ENV: 'production', DATABASE_URL: urlWithoutTls }),
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
        loadEnv({
          NODE_ENV: 'development',
          DATABASE_URL: `postgresql://usuario:senha@localhost:6543/postgres?schema=fiap_school&sslmode=${sslmode}`,
        }),
      ).toThrow('DATABASE_URL deve exigir TLS com sslmode=verify-full');
    },
  );

  it('recusa URL do banco sem schema', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'development',
        DATABASE_URL:
          'postgresql://usuario:senha@localhost:6543/postgres?sslmode=verify-full',
      }),
    ).toThrow('DATABASE_URL deve indicar o schema');
  });

  it('relata todos os problemas de uma vez', () => {
    const message = errorMessageOf(() => loadEnv({ PORT: 'abc' }));

    expect(message).toContain('NODE_ENV');
    expect(message).toContain('PORT');
    expect(message).toContain('DATABASE_URL');
  });
});
