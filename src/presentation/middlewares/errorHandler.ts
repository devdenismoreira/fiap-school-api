import type { ErrorRequestHandler } from 'express';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  StudentNotFoundError,
} from '@/domain/errors/DomainErrors';
import type { Logger } from '@/domain/ports/Logger';
import { InvalidRequestError } from '@/presentation/middlewares/validate';
import { errorView } from '@/presentation/views/errorView';

type ErrorResponse = Readonly<{
  status: number;
  code: string;
  message: string;
}>;

type ErrorClass = abstract new (...args: never[]) => Error;

const INVALID_DATA: ErrorResponse = {
  status: 400,
  code: 'DADOS_INVALIDOS',
  message: 'Dados inválidos.',
};

const INTERNAL_ERROR: ErrorResponse = {
  status: 500,
  code: 'ERRO_INTERNO',
  message: 'Erro interno.',
};

const KNOWN_ERRORS: ReadonlyArray<readonly [ErrorClass, ErrorResponse]> = [
  [InvalidRequestError, INVALID_DATA],
  [
    InvalidCredentialsError,
    {
      status: 401,
      code: 'CREDENCIAIS_INVALIDAS',
      message: 'Usuário ou senha inválida.',
    },
  ],
  [
    InvalidAccessTokenError,
    {
      status: 401,
      code: 'TOKEN_INVALIDO',
      message: 'Token de acesso inválido.',
    },
  ],
  [
    ExpiredAccessTokenError,
    {
      status: 401,
      code: 'TOKEN_EXPIRADO',
      message: 'Token de acesso expirado.',
    },
  ],
  [
    InvalidRefreshTokenError,
    {
      status: 401,
      code: 'REFRESH_INVALIDO',
      message: 'Sessão inválida ou expirada.',
    },
  ],
  [
    StudentNotFoundError,
    {
      status: 404,
      code: 'ALUNO_NAO_ENCONTRADO',
      message: 'Aluno não encontrado.',
    },
  ],
];

function isRequestBodyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
  );
}

function knownResponse(error: unknown): ErrorResponse | undefined {
  if (isRequestBodyError(error)) {
    return INVALID_DATA;
  }
  return KNOWN_ERRORS.find(([errorClass]) => error instanceof errorClass)?.[1];
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    const known = knownResponse(error);
    if (!known) {
      logger.error({ err: error }, 'Erro inesperado');
    }
    const { status, code, message } = known ?? INTERNAL_ERROR;
    response.status(status).json(errorView(code, message));
  };
}
