import type { Request, RequestHandler } from 'express';
import {
  rateLimit,
  type AugmentedRequest,
  type Options,
  type Store,
} from 'express-rate-limit';
import { createHmac } from 'node:crypto';
import type { Logger } from '@/domain/ports/Logger';
import { errorView } from '@/presentation/views/errorView';

export type RateLimitConfig = Readonly<{
  windowMs: number;
  limit: number;
  store?: Store;
}>;

type LimitKind = 'ip' | 'cpf';

function isPreflight(request: Request): boolean {
  return request.method === 'OPTIONS';
}

function retryAfterSeconds(resetTime: Date | undefined, windowMs: number) {
  const remaining = resetTime ? resetTime.getTime() - Date.now() : windowMs;
  return Math.max(1, Math.ceil(remaining / 1000));
}

function tooManyRequests(logger: Logger, kind: LimitKind): Options['handler'] {
  return (request, response, _next, options) => {
    const info = (request as AugmentedRequest)[options.requestPropertyName];
    response.set(
      'Retry-After',
      String(retryAfterSeconds(info?.resetTime, options.windowMs)),
    );
    logger.info(
      { evento: 'muitas_tentativas', limite: kind },
      'Limite de tentativas atingido',
    );
    response
      .status(429)
      .json(
        errorView(
          'MUITAS_TENTATIVAS',
          'Muitas tentativas. Tente novamente mais tarde.',
        ),
      );
  };
}

export function createIpRateLimit(
  config: RateLimitConfig,
  logger: Logger,
): RequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: isPreflight,
    handler: tooManyRequests(logger, 'ip'),
    ...(config.store ? { store: config.store } : {}),
  });
}

export function cpfRateLimitKey(cpf: string, secret: string): string {
  return createHmac('sha256', secret).update(cpf).digest('hex');
}

function cpfFrom(request: Request): string {
  const body: unknown = request.body;
  if (typeof body === 'object' && body !== null && 'cpf' in body) {
    return typeof body.cpf === 'string' ? body.cpf : '';
  }
  return '';
}

export function createCpfRateLimit(
  config: RateLimitConfig,
  secret: string,
  logger: Logger,
): RequestHandler {
  const keyFor = (request: Request) =>
    cpfRateLimitKey(cpfFrom(request), secret);
  const limiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: isPreflight,
    skipSuccessfulRequests: true,
    keyGenerator: keyFor,
    handler: tooManyRequests(logger, 'cpf'),
    ...(config.store ? { store: config.store } : {}),
  });
  return (request, response, next) => {
    response.on('finish', () => {
      if (response.statusCode < 400) {
        limiter.resetKey(keyFor(request));
      }
    });
    return limiter(request, response, next);
  };
}
