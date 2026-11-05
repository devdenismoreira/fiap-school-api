import type { RefreshToken } from '@/domain/entities/RefreshToken';
import type { Session } from '@/domain/entities/Session';
import { InvalidRefreshTokenError } from '@/domain/errors/DomainErrors';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';
import { createRefreshSession } from './refreshSession';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const TOKEN_ID = '3d7b0b1e-5a4f-4c2d-9e8f-1a2b3c4d5e6f';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const TTL_SECONDS = 2_592_000;

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    guardianId: 7,
    createdAt: NOW,
    lastUsedAt: NOW,
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

function token(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: TOKEN_ID,
    sessionId: SESSION_ID,
    expiresAt: new Date(NOW.getTime() + 1000),
    usedAt: null,
    ...overrides,
  };
}

function setup(
  found: { token: RefreshToken; session: Session } | null,
  rotated = true,
) {
  const findByRefreshHash = jest.fn((_hash: string) => Promise.resolve(found));
  const rotate = jest.fn(() => Promise.resolve(rotated));
  const revoke = jest.fn(() => Promise.resolve());
  const issue = jest.fn(() =>
    Promise.resolve({ token: 'novo-access', expiresInSeconds: 900 }),
  );
  const logger = { info: jest.fn(), error: jest.fn() };
  const sessions: SessionRepository = {
    create: jest.fn(),
    findActive: jest.fn(),
    findByRefreshHash,
    rotate,
    revoke,
    recordUse: jest.fn(),
  };
  const refreshSession = createRefreshSession({
    sessions,
    refreshTokens: {
      generate: () => ({ token: 'novo-refresh', hash: 'hash-do-novo' }),
      hash: (value: string) => `hash(${value})`,
    },
    accessTokens: { issue, verify: jest.fn() },
    clock: { now: () => NOW },
    logger,
    refreshTokenTtlSeconds: TTL_SECONDS,
  });
  return { refreshSession, findByRefreshHash, rotate, revoke, issue, logger };
}

describe('refreshSession', () => {
  it('busca pelo hash, gira o refresh e emite um access novo com o mesmo sid', async () => {
    const { refreshSession, findByRefreshHash, rotate, issue } = setup({
      token: token(),
      session: session(),
    });

    await expect(refreshSession('refresh-atual')).resolves.toEqual({
      accessToken: 'novo-access',
      accessTokenExpiresIn: 900,
      refreshToken: 'novo-refresh',
      refreshTokenExpiresIn: TTL_SECONDS,
    });
    expect(findByRefreshHash).toHaveBeenCalledWith('hash(refresh-atual)');
    expect(rotate).toHaveBeenCalledWith(
      TOKEN_ID,
      {
        hash: 'hash-do-novo',
        expiresAt: new Date(NOW.getTime() + TTL_SECONDS * 1000),
      },
      NOW,
    );
    expect(issue).toHaveBeenCalledWith({
      guardianId: 7,
      sessionId: SESSION_ID,
    });
  });

  it('recusa refresh desconhecido', async () => {
    const { refreshSession, rotate } = setup(null);

    await expect(refreshSession('qualquer')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(rotate).not.toHaveBeenCalled();
  });

  it('recusa refresh de sessão revogada, sem revogar de novo', async () => {
    const { refreshSession, rotate, revoke } = setup({
      token: token(),
      session: session({ revokedAt: NOW, revokedReason: 'logout' }),
    });

    await expect(refreshSession('refresh')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(rotate).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('refresh já usado é reuso: revoga a sessão e registra só o sessao_id', async () => {
    const { refreshSession, rotate, revoke, logger } = setup({
      token: token({ usedAt: NOW }),
      session: session(),
    });

    await expect(refreshSession('refresh-antigo')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(revoke).toHaveBeenCalledWith(SESSION_ID, 'reuso', NOW);
    expect(rotate).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'refresh_reutilizado', sessaoId: SESSION_ID },
      'Refresh token reutilizado: sessão revogada',
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'refresh-antigo',
    );
  });

  it('refresh vencido é recusado sem revogar a sessão', async () => {
    const { refreshSession, rotate, revoke } = setup({
      token: token({ expiresAt: NOW }),
      session: session(),
    });

    await expect(refreshSession('refresh')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(rotate).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('se outra requisição girou o mesmo token antes (corrida), trata como reuso', async () => {
    const { refreshSession, revoke, issue } = setup(
      { token: token(), session: session() },
      false,
    );

    await expect(refreshSession('refresh')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(revoke).toHaveBeenCalledWith(SESSION_ID, 'reuso', NOW);
    expect(issue).not.toHaveBeenCalled();
  });
});
