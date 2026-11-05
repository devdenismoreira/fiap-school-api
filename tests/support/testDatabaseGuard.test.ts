import { findTestDatabaseProblem } from './testDatabaseGuard';

function databaseUrl(schema: string, sslmode = 'require'): string {
  return `postgresql://usuario:senha-ficticia@localhost:5432/postgres?schema=${schema}&sslmode=${sslmode}`;
}

describe('findTestDatabaseProblem', () => {
  it('libera quando DATABASE_URL e DIRECT_URL apontam para um schema _test', () => {
    expect(
      findTestDatabaseProblem({
        DATABASE_URL: databaseUrl('fiap_school_test'),
        DIRECT_URL: databaseUrl('fiap_school_test'),
      }),
    ).toBeUndefined();
  });

  it('bloqueia DATABASE_URL apontando para o schema de desenvolvimento', () => {
    const problem = findTestDatabaseProblem({
      DATABASE_URL: databaseUrl('fiap_school'),
      DIRECT_URL: databaseUrl('fiap_school_test'),
    });

    expect(problem).toContain('DATABASE_URL');
    expect(problem).toContain('não termina em _test');
  });

  it('bloqueia DIRECT_URL fora do _test, porque as migrations usam essa URL', () => {
    const problem = findTestDatabaseProblem({
      DATABASE_URL: databaseUrl('fiap_school_test'),
      DIRECT_URL: databaseUrl('fiap_school'),
    });

    expect(problem).toContain('DIRECT_URL');
  });

  it('bloqueia schema que só contém _test no meio do nome', () => {
    const problem = findTestDatabaseProblem({
      DATABASE_URL: databaseUrl('fiap_school_test_copia'),
      DIRECT_URL: databaseUrl('fiap_school_test'),
    });

    expect(problem).toContain('não termina em _test');
  });

  it('bloqueia quando falta uma das variáveis', () => {
    expect(
      findTestDatabaseProblem({
        DATABASE_URL: databaseUrl('fiap_school_test'),
      }),
    ).toBe('DIRECT_URL não está definida no .env.test');
  });

  it('bloqueia URL sem TLS obrigatório', () => {
    const problem = findTestDatabaseProblem({
      DATABASE_URL: databaseUrl('fiap_school_test', 'disable'),
      DIRECT_URL: databaseUrl('fiap_school_test'),
    });

    expect(problem).toContain('sslmode');
  });

  it('não mostra a senha da URL na mensagem', () => {
    const problem = findTestDatabaseProblem({
      DATABASE_URL: databaseUrl('fiap_school'),
      DIRECT_URL: databaseUrl('fiap_school'),
    });

    expect(problem).not.toContain('senha-ficticia');
  });
});
