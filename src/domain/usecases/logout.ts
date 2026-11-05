import { isSessionActive } from '@/domain/entities/Session';
import type { Clock } from '@/domain/ports/Clock';
import type { Logger } from '@/domain/ports/Logger';
import type { RefreshTokenGenerator } from '@/domain/ports/RefreshTokenGenerator';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';

export type LogoutDependencies = Readonly<{
  sessions: SessionRepository;
  refreshTokens: RefreshTokenGenerator;
  clock: Clock;
  logger: Logger;
}>;

export type Logout = (refreshToken: string) => Promise<void>;

export function createLogout(dependencies: LogoutDependencies): Logout {
  const { sessions, refreshTokens, clock, logger } = dependencies;
  return async refreshToken => {
    const found = await sessions.findByRefreshHash(
      refreshTokens.hash(refreshToken),
    );
    if (!found || !isSessionActive(found.session)) {
      return;
    }
    await sessions.revoke(found.session.id, 'logout', clock.now());
    logger.info(
      {
        evento: 'sessao_revogada',
        motivo: 'logout',
        sessaoId: found.session.id,
      },
      'Sessão encerrada pelo logout',
    );
  };
}
