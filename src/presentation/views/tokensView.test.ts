import { loginView, tokensView } from './tokensView';

const tokens = {
  accessToken: 'access-token',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-opaco',
  refreshTokenExpiresIn: 2_592_000,
};

describe('tokensView', () => {
  it('monta os tokens no formato do contrato', () => {
    expect(tokensView(tokens)).toStrictEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: 'refresh-opaco',
      refreshExpiresIn: 2_592_000,
    });
  });
});

describe('loginView', () => {
  it('acrescenta o responsável aos tokens, sem outros campos', () => {
    const view = loginView({
      tokens,
      guardian: { id: 7, firstName: 'Ana', lastName: 'Exemplo', students: [] },
    });

    expect(Object.keys(view).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'refreshExpiresIn',
      'refreshToken',
      'responsavel',
      'tokenType',
    ]);
    expect(view.responsavel).toStrictEqual({
      id: 7,
      primeiroNome: 'Ana',
      sobrenome: 'Exemplo',
      alunos: [],
    });
  });
});
