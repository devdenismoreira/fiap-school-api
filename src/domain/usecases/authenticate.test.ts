import type { Session } from '@/domain/entities/Session';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '@/domain/errors/DomainErrors';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';
import { createAuthenticate } from './authenticate';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const NOW = new Date('2026-11-05T12:00:00.000Z');

function sessionUsed(secondsAgo: number): Session {
  const lastUsedAt = new Date(NOW.getTime() - secondsAgo * 1000);
  return {
    id: SESSION_ID,
    guardianId: 7,
    createdAt: lastUsedAt,
    lastUsedAt,
    revokedAt: null,
    revokedReason: null,
  };
}

function setup(options: { session?: Session | null; verifyError?: Error }) {
  const verify = jest.fn((_token: string) =>
    options.verifyError
      ? Promise.reject(options.verifyError)
      : Promise.resolve({ guardianId: 7, sessionId: SESSION_ID }),
  );
  const findActive = jest.fn(() =>
    Promise.resolve(
      options.session === undefined ? sessionUsed(5) : options.session,
    ),
  );
  const recordUse = jest.fn(() => Promise.resolve());
  const sessions: SessionRepository = {
    create: jest.fn(),
    findActive,
    findByRefreshHash: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    recordUse,
  };
  const authenticate = createAuthenticate({
    accessTokens: { issue: jest.fn(), verify },
    sessions,
    clock: { now: () => NOW },
  });
  return { authenticate, verify, findActive, recordUse };
}

describe('authenticate', () => {
  it('devolve guardianId e sessionId do token de uma sessão ativa', async () => {
    const { authenticate, verify, findActive } = setup({});

    await expect(authenticate('token')).resolves.toEqual({
      guardianId: 7,
      sessionId: SESSION_ID,
    });
    expect(verify).toHaveBeenCalledWith('token');
    expect(findActive).toHaveBeenCalledWith(SESSION_ID, 7);
  });

  it('recusa o token de sessão revogada, inexistente ou de outro responsável', async () => {
    const { authenticate } = setup({ session: null });

    await expect(authenticate('token')).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it.each([new InvalidAccessTokenError(), new ExpiredAccessTokenError()])(
    'propaga a recusa do token (%s) sem consultar a sessão',
    async error => {
      const { authenticate, findActive } = setup({ verifyError: error });

      await expect(authenticate('token')).rejects.toBe(error);
      expect(findActive).not.toHaveBeenCalled();
    },
  );

  it('registra o uso da sessão quando o último uso tem 60 s ou mais', async () => {
    const { authenticate, recordUse } = setup({ session: sessionUsed(60) });

    await authenticate('token');

    expect(recordUse).toHaveBeenCalledWith(SESSION_ID, NOW);
  });

  it('não grava de novo quando o último uso tem menos de 60 s', async () => {
    const { authenticate, recordUse } = setup({ session: sessionUsed(59) });

    await authenticate('token');

    expect(recordUse).not.toHaveBeenCalled();
  });
});
