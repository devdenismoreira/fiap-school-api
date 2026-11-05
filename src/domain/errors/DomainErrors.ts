export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError';

  constructor() {
    super('Credenciais inválidas.');
  }
}

export class InvalidAccessTokenError extends Error {
  override readonly name = 'InvalidAccessTokenError';

  constructor() {
    super('Token de acesso inválido.');
  }
}

export class ExpiredAccessTokenError extends Error {
  override readonly name = 'ExpiredAccessTokenError';

  constructor() {
    super('Token de acesso expirado.');
  }
}

export class InvalidRefreshTokenError extends Error {
  override readonly name = 'InvalidRefreshTokenError';

  constructor() {
    super('Refresh token inválido.');
  }
}

export class StudentNotFoundError extends Error {
  override readonly name = 'StudentNotFoundError';

  constructor() {
    super('Aluno não encontrado.');
  }
}
