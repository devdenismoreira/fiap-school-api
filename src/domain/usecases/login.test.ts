import type { Guardian } from '@/domain/entities/Guardian';
import type { Session } from '@/domain/entities/Session';
import { InvalidCredentialsError } from '@/domain/errors/DomainErrors';
import { createLogin } from './login';

const VALID_CPF = '86686328685';
const OTHER_VALID_CPF = '06127842581';
const INVALID_CHECK_DIGIT_CPF = '86686328695';
const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const REFRESH_TTL_SECONDS = 2_592_000;

const guardian: Guardian = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Exemplo',
  students: [],
};

function setup() {
  const findByCpf = jest.fn((cpf: string) =>
    Promise.resolve(
      cpf === VALID_CPF ? { guardianId: 7, passwordHash: 'hash-7' } : null,
    ),
  );
  const findById = jest.fn((id: number) =>
    Promise.resolve(id === 7 ? guardian : null),
  );
  const verify = jest.fn((password: string, hash: string | null) =>
    Promise.resolve(hash === 'hash-7' && password === 'senha-certa'),
  );
  const create = jest.fn((guardianId: number): Promise<Session> =>
    Promise.resolve({
      id: SESSION_ID,
      guardianId,
      createdAt: NOW,
      lastUsedAt: NOW,
      revokedAt: null,
      revokedReason: null,
    }),
  );
  const issue = jest.fn(() =>
    Promise.resolve({ token: 'access-token', expiresInSeconds: 900 }),
  );
  const login = createLogin({
    guardians: { findByCpf, findById, findLinkedStudent: jest.fn() },
    sessions: {
      create,
      findActive: jest.fn(),
      findByRefreshHash: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
      recordUse: jest.fn(),
    },
    passwordHasher: { verify },
    refreshTokens: {
      generate: () => ({ token: 'refresh-opaco', hash: 'hash-do-refresh' }),
      hash: jest.fn(),
    },
    accessTokens: { issue, verify: jest.fn() },
    clock: { now: () => NOW },
    refreshTokenTtlSeconds: REFRESH_TTL_SECONDS,
  });
  return { login, findByCpf, findById, verify, create, issue };
}

describe('login', () => {
  it('com credenciais corretas, abre a sessão e devolve o responsável e os tokens', async () => {
    const { login, create, issue } = setup();

    await expect(
      login({ cpf: VALID_CPF, password: 'senha-certa' }),
    ).resolves.toEqual({
      guardian,
      tokens: {
        accessToken: 'access-token',
        accessTokenExpiresIn: 900,
        refreshToken: 'refresh-opaco',
        refreshTokenExpiresIn: REFRESH_TTL_SECONDS,
      },
    });
    expect(create).toHaveBeenCalledWith(7, {
      hash: 'hash-do-refresh',
      expiresAt: new Date(NOW.getTime() + REFRESH_TTL_SECONDS * 1000),
    });
    expect(issue).toHaveBeenCalledWith({
      guardianId: 7,
      sessionId: SESSION_ID,
    });
  });

  it('com dígito verificador inválido, não consulta o banco, mas verifica o hash fictício', async () => {
    const { login, findByCpf, verify, create } = setup();

    await expect(
      login({ cpf: INVALID_CHECK_DIGIT_CPF, password: 'senha-certa' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(findByCpf).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalledWith('senha-certa', null);
    expect(create).not.toHaveBeenCalled();
  });

  it('com CPF inexistente, verifica o hash fictício e recusa', async () => {
    const { login, verify, create } = setup();

    await expect(
      login({ cpf: OTHER_VALID_CPF, password: 'senha-certa' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(verify).toHaveBeenCalledWith('senha-certa', null);
    expect(create).not.toHaveBeenCalled();
  });

  it('com senha errada, recusa sem carregar o agregado nem abrir sessão', async () => {
    const { login, findById, create, issue } = setup();

    await expect(
      login({ cpf: VALID_CPF, password: 'senha-errada' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(findById).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('os três casos de falha produzem o mesmo erro, com a mesma mensagem', async () => {
    const { login } = setup();
    const attempts = [
      { cpf: INVALID_CHECK_DIGIT_CPF, password: 'senha-certa' },
      { cpf: OTHER_VALID_CPF, password: 'senha-certa' },
      { cpf: VALID_CPF, password: 'senha-errada' },
    ];

    const errors = await Promise.all(
      attempts.map(attempt => login(attempt).catch((error: unknown) => error)),
    );

    for (const error of errors) {
      expect(error).toBeInstanceOf(InvalidCredentialsError);
      expect((error as Error).message).toBe('Credenciais inválidas.');
    }
  });
});
