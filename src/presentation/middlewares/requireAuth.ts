import type { RequestHandler, Response } from 'express';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import type { AccessTokenService } from '@/domain/ports/AccessTokenService';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';

export type AuthenticatedContext = Readonly<{
  guardianId: number;
  sessionId: string;
}>;

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9\-_.]+)$/i;

export function createRequireAuth(
  accessTokens: AccessTokenService,
  sessions: SessionRepository,
): RequestHandler {
  return async (request, response, next) => {
    const token = BEARER_PATTERN.exec(request.get('authorization') ?? '')?.[1];
    if (!token) {
      throw new InvalidAccessTokenError();
    }
    const claims = await accessTokens.verify(token);
    const session = await sessions.findActive(
      claims.sessionId,
      claims.guardianId,
    );
    if (!session) {
      throw new InvalidAccessTokenError();
    }
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
