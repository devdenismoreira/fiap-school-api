import {
  isRefreshTokenExpired,
  isRefreshTokenUsed,
} from '@/domain/entities/RefreshToken';
import { isSessionActive } from '@/domain/entities/Session';
import { InvalidRefreshTokenError } from '@/domain/errors/DomainErrors';
import type { AccessTokenService } from '@/domain/ports/AccessTokenService';
import type { Clock } from '@/domain/ports/Clock';
import type { Logger } from '@/domain/ports/Logger';
import type { RefreshTokenGenerator } from '@/domain/ports/RefreshTokenGenerator';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';
import type { SessionTokens } from './sessionTokens';

export type RefreshSessionDependencies = Readonly<{
  sessions: SessionRepository;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenService;
  clock: Clock;
  logger: Logger;
  refreshTokenTtlSeconds: number;
}>;

export type RefreshSession = (refreshToken: string) => Promise<SessionTokens>;

export function createRefreshSession(
  dependencies: RefreshSessionDependencies,
): RefreshSession {
  const {
    sessions,
    refreshTokens,
    accessTokens,
    clock,
    logger,
    refreshTokenTtlSeconds,
  } = dependencies;

  async function revokeForReuse(sessionId: string, now: Date): Promise<never> {
    await sessions.revoke(sessionId, 'reuso', now);
    logger.info(
      { evento: 'refresh_reutilizado', sessaoId: sessionId },
      'Refresh token reutilizado: sessão revogada',
    );
    throw new InvalidRefreshTokenError();
  }

  return async refreshToken => {
    const found = await sessions.findByRefreshHash(
      refreshTokens.hash(refreshToken),
    );
    if (!found || !isSessionActive(found.session)) {
      throw new InvalidRefreshTokenError();
    }
    const { token, session } = found;
    const now = clock.now();
    if (isRefreshTokenUsed(token)) {
      return revokeForReuse(session.id, now);
    }
    if (isRefreshTokenExpired(token, now)) {
      throw new InvalidRefreshTokenError();
    }

    const next = refreshTokens.generate();
    const rotated = await sessions.rotate(
      token.id,
      {
        hash: next.hash,
        expiresAt: new Date(now.getTime() + refreshTokenTtlSeconds * 1000),
      },
      now,
    );
    if (!rotated) {
      return revokeForReuse(session.id, now);
    }

    const access = await accessTokens.issue({
      guardianId: session.guardianId,
      sessionId: session.id,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: next.token,
      refreshTokenExpiresIn: refreshTokenTtlSeconds,
    };
  };
}
