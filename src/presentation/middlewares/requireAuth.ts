import type { RequestHandler, Response } from 'express';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import type { Authenticate } from '@/domain/usecases/authenticate';

export type AuthenticatedContext = Readonly<{
  guardianId: number;
  sessionId: string;
}>;

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9\-_.]+)$/i;

export function createRequireAuth(authenticate: Authenticate): RequestHandler {
  return async (request, response, next) => {
    const token = BEARER_PATTERN.exec(request.get('authorization') ?? '')?.[1];
    if (!token) {
      throw new InvalidAccessTokenError();
    }
    const claims = await authenticate(token);
    response.locals.auth = {
      guardianId: claims.guardianId,
      sessionId: claims.sessionId,
    };
    next();
  };
}

export function authenticatedContext(response: Response): AuthenticatedContext {
  const auth = response.locals.auth;
  if (!auth) {
    throw new InvalidAccessTokenError();
  }
  return auth;
}
