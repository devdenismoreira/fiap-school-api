import type { ErrorRequestHandler } from 'express';
import type { Logger } from '@/domain/ports/Logger';
import { errorView } from '@/presentation/views/errorView';

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

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    if (isRequestBodyError(error)) {
      response
        .status(400)
        .json(errorView('DADOS_INVALIDOS', 'Dados inválidos.'));
      return;
    }
    logger.error({ err: error }, 'Erro inesperado');
    response.status(500).json(errorView('ERRO_INTERNO', 'Erro interno.'));
  };
}
