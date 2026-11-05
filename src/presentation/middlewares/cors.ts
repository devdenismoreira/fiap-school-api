import cors from 'cors';
import type { RequestHandler } from 'express';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

export function createCors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  const isAllowed = (origin: string | undefined) =>
    origin !== undefined && allowed.has(origin);
  const corsMiddleware = cors({
    origin: (origin, callback) => {
      callback(null, isAllowed(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Retry-After'],
    credentials: false,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  });

  return (request, response, next) => {
    const origin = request.get('origin');
    if (
      request.method === 'OPTIONS' &&
      origin !== undefined &&
      !isAllowed(origin)
    ) {
      response.status(403).end();
      return;
    }
    corsMiddleware(request, response, next);
  };
}
