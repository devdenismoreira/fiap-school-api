import { shouldRecordSessionUse } from '@/domain/entities/Session';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import type {
  AccessTokenClaims,
  AccessTokenService,
} from '@/domain/ports/AccessTokenService';
import type { Clock } from '@/domain/ports/Clock';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';

export type AuthenticateDependencies = Readonly<{
  accessTokens: AccessTokenService;
  sessions: SessionRepository;
  clock: Clock;
}>;

export type Authenticate = (accessToken: string) => Promise<AccessTokenClaims>;

export function createAuthenticate(
  dependencies: AuthenticateDependencies,
): Authenticate {
  const { accessTokens, sessions, clock } = dependencies;
  return async accessToken => {
    const claims = await accessTokens.verify(accessToken);
    const session = await sessions.findActive(
      claims.sessionId,
      claims.guardianId,
    );
    if (!session) {
      throw new InvalidAccessTokenError();
    }
    const now = clock.now();
    if (shouldRecordSessionUse(session, now)) {
      await sessions.recordUse(session.id, now);
    }
    return claims;
  };
}
