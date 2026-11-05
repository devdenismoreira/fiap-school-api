import { isValidCpf } from '@/domain/entities/Cpf';
import type { Guardian } from '@/domain/entities/Guardian';
import { InvalidCredentialsError } from '@/domain/errors/DomainErrors';
import type { AccessTokenService } from '@/domain/ports/AccessTokenService';
import type { Clock } from '@/domain/ports/Clock';
import type { PasswordHasher } from '@/domain/ports/PasswordHasher';
import type { RefreshTokenGenerator } from '@/domain/ports/RefreshTokenGenerator';
import type { GuardianRepository } from '@/domain/repositories/GuardianRepository';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';

export type LoginInput = Readonly<{ cpf: string; password: string }>;

export type SessionTokens = Readonly<{
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}>;

export type LoginResult = Readonly<{
  guardian: Guardian;
  tokens: SessionTokens;
}>;

export type LoginDependencies = Readonly<{
  guardians: GuardianRepository;
  sessions: SessionRepository;
  passwordHasher: PasswordHasher;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenService;
  clock: Clock;
  refreshTokenTtlSeconds: number;
}>;

export type Login = (input: LoginInput) => Promise<LoginResult>;

export function createLogin(dependencies: LoginDependencies): Login {
  const {
    guardians,
    sessions,
    passwordHasher,
    refreshTokens,
    accessTokens,
    clock,
    refreshTokenTtlSeconds,
  } = dependencies;

  return async ({ cpf, password }) => {
    const credentials = isValidCpf(cpf) ? await guardians.findByCpf(cpf) : null;
    const passwordMatches = await passwordHasher.verify(
      password,
      credentials?.passwordHash ?? null,
    );
    if (!credentials || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const guardian = await guardians.findById(credentials.guardianId);
    if (!guardian) {
      throw new InvalidCredentialsError();
    }

    const refresh = refreshTokens.generate();
    const session = await sessions.create(guardian.id, {
      hash: refresh.hash,
      expiresAt: new Date(
        clock.now().getTime() + refreshTokenTtlSeconds * 1000,
      ),
    });
    const access = await accessTokens.issue({
      guardianId: guardian.id,
      sessionId: session.id,
    });

    return {
      guardian,
      tokens: {
        accessToken: access.token,
        accessTokenExpiresIn: access.expiresInSeconds,
        refreshToken: refresh.token,
        refreshTokenExpiresIn: refreshTokenTtlSeconds,
      },
    };
  };
}
