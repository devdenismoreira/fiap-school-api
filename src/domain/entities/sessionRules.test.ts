import {
  isRefreshTokenExpired,
  isRefreshTokenUsed,
  type RefreshToken,
} from './RefreshToken';
import { isSessionActive, type Session } from './Session';

const now = new Date('2026-11-05T12:00:00.000Z');

function session(revokedAt: Date | null): Session {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    guardianId: 1,
    createdAt: now,
    lastUsedAt: now,
    revokedAt,
    revokedReason: revokedAt ? 'logout' : null,
  };
}

function token(overrides: Partial<RefreshToken>): RefreshToken {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    sessionId: '00000000-0000-4000-8000-000000000001',
    expiresAt: new Date(now.getTime() + 1000),
    usedAt: null,
    ...overrides,
  };
}

describe('isSessionActive', () => {
  it('sessão sem revogação está ativa', () => {
    expect(isSessionActive(session(null))).toBe(true);
  });

  it('sessão revogada não está ativa', () => {
    expect(isSessionActive(session(now))).toBe(false);
  });
});

describe('regras do refresh token', () => {
  it('token com usado_em foi usado', () => {
    expect(isRefreshTokenUsed(token({ usedAt: now }))).toBe(true);
    expect(isRefreshTokenUsed(token({}))).toBe(false);
  });

  it('expira no instante exato da validade', () => {
    expect(isRefreshTokenExpired(token({ expiresAt: now }), now)).toBe(true);
    expect(
      isRefreshTokenExpired(
        token({ expiresAt: new Date(now.getTime() + 1) }),
        now,
      ),
    ).toBe(false);
  });
});
