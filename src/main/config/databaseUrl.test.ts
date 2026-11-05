import {
  assertDatabaseUrl,
  checkDatabaseUrl,
  VERIFIED_SSL_MODES,
} from './databaseUrl';

function databaseUrl(query: string): string {
  return `postgresql://usuario:senha-ficticia@localhost:5432/postgres?${query}`;
}

describe('checkDatabaseUrl exigindo certificado validado', () => {
  it('aceita sslmode=verify-full', () => {
    expect(
      checkDatabaseUrl(
        databaseUrl(
          'schema=fiap_school&sslmode=verify-full&sslrootcert=certs/supabase-ca.crt',
        ),
        VERIFIED_SSL_MODES,
      ),
    ).toEqual({ valid: true, schema: 'fiap_school' });
  });

  it.each(['require', 'verify-ca'])(
    'recusa sslmode=%s, que não garante a validação do certificado',
    sslmode => {
      expect(
        checkDatabaseUrl(
          databaseUrl(`schema=fiap_school&sslmode=${sslmode}`),
          VERIFIED_SSL_MODES,
        ),
      ).toEqual({
        valid: false,
        problem: 'deve exigir TLS com sslmode=verify-full',
      });
    },
  );
});

describe('checkDatabaseUrl', () => {
  it('aceita URL com TLS obrigatório e schema, e devolve o schema', () => {
    expect(
      checkDatabaseUrl(databaseUrl('schema=fiap_school&sslmode=require')),
    ).toEqual({ valid: true, schema: 'fiap_school' });
  });

  it.each(['require', 'verify-ca', 'verify-full'])(
    'aceita sslmode=%s',
    sslmode => {
      expect(
        checkDatabaseUrl(databaseUrl(`schema=fiap_school&sslmode=${sslmode}`))
          .valid,
      ).toBe(true);
    },
  );

  it.each([
    'schema=fiap_school',
    'schema=fiap_school&sslmode=disable',
    'schema=fiap_school&sslmode=prefer',
    'schema=fiap_school&sslmode=allow',
  ])('recusa URL sem TLS obrigatório (%s)', query => {
    expect(checkDatabaseUrl(databaseUrl(query))).toEqual({
      valid: false,
      problem: 'deve exigir TLS com sslmode=require, verify-ca ou verify-full',
    });
  });

  it.each([
    'sslmode=require',
    'schema=&sslmode=require',
    'schema=fiap;drop&sslmode=require',
    'schema=Fiap&sslmode=require',
  ])('recusa URL sem schema válido (%s)', query => {
    expect(checkDatabaseUrl(databaseUrl(query)).valid).toBe(false);
  });

  it.each([
    'texto qualquer',
    'mysql://usuario:senha@localhost/db?schema=a&sslmode=require',
  ])('recusa o que não é URL postgresql (%s)', value => {
    expect(checkDatabaseUrl(value)).toEqual({
      valid: false,
      problem: 'deve ser uma URL postgresql:// válida',
    });
  });
});

describe('assertDatabaseUrl', () => {
  it('devolve o schema de uma URL válida', () => {
    expect(
      assertDatabaseUrl(
        'DIRECT_URL',
        databaseUrl('schema=fiap_school&sslmode=require'),
      ),
    ).toBe('fiap_school');
  });

  it('lança erro com o nome da variável, sem mostrar o valor', () => {
    const value = databaseUrl('schema=fiap_school');

    expect(() => assertDatabaseUrl('DIRECT_URL', value)).toThrow(
      'Variável de ambiente inválida: DIRECT_URL deve exigir TLS',
    );
    expect(() => assertDatabaseUrl('DIRECT_URL', value)).not.toThrow(
      'senha-ficticia',
    );
  });
});
