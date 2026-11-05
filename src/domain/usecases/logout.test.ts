import type { Session } from '@/domain/entities/Session';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';
import { createLogout } from './logout';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const NOW = new Date('2026-11-05T12:00:00.000Z');

function session(revokedAt: Date | null): Session {
  return {
    id: SESSION_ID,
    guardianId: 7,
    createdAt: NOW,
    lastUsedAt: NOW,
    revokedAt,
    revokedReason: revokedAt ? 'logout' : null,
  };
}

function setup(found: Session | null) {
  const revoke = jest.fn(() => Promise.resolve());
  const logger = { info: jest.fn(), error: jest.fn() };
  const sessions: SessionRepository = {
    create: jest.fn(),
    findActive: jest.fn(),
    findByRefreshHash: jest.fn(() =>
      Promise.resolve(
        found
          ? {
              session: found,
              token: {
                id: 'token',
                sessionId: SESSION_ID,
                expiresAt: NOW,
                usedAt: null,
              },
            }
          : null,
      ),
    ),
    rotate: jest.fn(),
    revoke,
    recordUse: jest.fn(),
  };
  const logout = createLogout({
    sessions,
    refreshTokens: { generate: jest.fn(), hash: value => `hash(${value})` },
    clock: { now: () => NOW },
    logger,
  });
  return { logout, revoke, logger };
}

describe('logout', () => {
  it('revoga a sessão do refresh com o motivo logout e registra só o sessao_id', async () => {
    const { logout, revoke, logger } = setup(session(null));

    await logout('refresh');

    expect(revoke).toHaveBeenCalledWith(SESSION_ID, 'logout', NOW);
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'sessao_revogada', motivo: 'logout', sessaoId: SESSION_ID },
      'Sessão encerrada pelo logout',
    );
  });

  it('não faz nada para refresh desconhecido, sem revelar que não existe', async () => {
    const { logout, revoke } = setup(null);

    await expect(logout('desconhecido')).resolves.toBeUndefined();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('é idempotente: sessão já revogada não é revogada de novo', async () => {
    const { logout, revoke } = setup(session(NOW));

    await expect(logout('refresh')).resolves.toBeUndefined();
    expect(revoke).not.toHaveBeenCalled();
  });
});
