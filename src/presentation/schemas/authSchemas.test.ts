import { loginSchema, refreshSchema } from './authSchemas';

const CPF = '86686328685';

describe('loginSchema', () => {
  it('aceita CPF de 11 dígitos e senha de 1 a 72 bytes', () => {
    expect(
      loginSchema.safeParse({ cpf: CPF, senha: 'a'.repeat(72) }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ cpf: CPF, senha: 'a' }).success).toBe(true);
  });

  it('conta bytes em UTF-8, não caracteres', () => {
    expect(
      loginSchema.safeParse({ cpf: CPF, senha: 'é'.repeat(36) }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ cpf: CPF, senha: 'é'.repeat(37) }).success,
    ).toBe(false);
  });

  it('não remove espaços da senha', () => {
    expect(loginSchema.parse({ cpf: CPF, senha: ' senha ' }).senha).toBe(
      ' senha ',
    );
  });

  it.each([
    ['senha com 73 bytes', { cpf: CPF, senha: 'a'.repeat(73) }],
    ['senha vazia', { cpf: CPF, senha: '' }],
    ['sem senha', { cpf: CPF }],
    ['CPF com máscara', { cpf: '866.863.286-85', senha: 'x' }],
    ['CPF com 10 dígitos', { cpf: '8668632868', senha: 'x' }],
    ['CPF numérico', { cpf: 86686328685, senha: 'x' }],
    ['sem CPF', { senha: 'x' }],
  ])('recusa %s', (_caso, body) => {
    expect(loginSchema.safeParse(body).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('aceita o refresh opaco em base64url', () => {
    expect(
      refreshSchema.safeParse({ refreshToken: 'A'.repeat(43) }).success,
    ).toBe(true);
  });

  it.each([
    ['sem o campo', {}],
    ['vazio', { refreshToken: '' }],
    ['curto demais', { refreshToken: 'abc' }],
    ['longo demais', { refreshToken: 'A'.repeat(129) }],
    [
      'com caracteres fora do base64url',
      { refreshToken: `${'A'.repeat(42)}=` },
    ],
    ['um JWT', { refreshToken: 'aaa.bbb.ccc'.repeat(4) }],
    ['número', { refreshToken: 123 }],
  ])('recusa refresh %s', (_caso, body) => {
    expect(refreshSchema.safeParse(body).success).toBe(false);
  });
});
