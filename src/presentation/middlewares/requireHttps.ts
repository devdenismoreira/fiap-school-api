import type { RequestHandler } from 'express';
import type { Logger } from '@/domain/ports/Logger';
import { errorView } from '@/presentation/views/errorView';

const HEALTH_PATH = '/health';

export function createRequireHttps(
  enabled: boolean,
  logger: Logger,
): RequestHandler {
  return (request, response, next) => {
    if (!enabled || request.secure || request.path === HEALTH_PATH) {
      next();
      return;
    }
    logger.info(
      { evento: 'http_recusado', metodo: request.method, rota: request.path },
      'Requisição sem TLS recusada',
    );
    response
      .status(403)
      .json(errorView('HTTPS_OBRIGATORIO', 'HTTPS obrigatório.'));
  };
}
