import type { Express } from 'express';
import type { DestinationStream } from 'pino';
import type { Logger } from '@/domain/ports/Logger';
import { createLogin } from '@/domain/usecases/login';
import { PrismaDatabaseHealthCheck } from '@/infra/database/PrismaDatabaseHealthCheck';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaGuardianRepository } from '@/infra/database/repositories/PrismaGuardianRepository';
import { PrismaSessionRepository } from '@/infra/database/repositories/PrismaSessionRepository';
import { createHttpLogger, createLogger } from '@/infra/logging/logger';
import { BcryptPasswordHasher } from '@/infra/security/BcryptPasswordHasher';
import { CryptoRefreshTokenGenerator } from '@/infra/security/CryptoRefreshTokenGenerator';
import { JoseAccessTokenService } from '@/infra/security/JoseAccessTokenService';
import { SystemClock } from '@/infra/security/SystemClock';
import { HealthController } from '@/presentation/controllers/HealthController';
import { LoginController } from '@/presentation/controllers/LoginController';
import {
  cpfRateLimitKey,
  createCpfRateLimit,
  createIpRateLimit,
} from '@/presentation/middlewares/rateLimit';
import { authRoutes } from '@/presentation/routes/authRoutes';
import { healthRoutes } from '@/presentation/routes/healthRoutes';
import { createApp } from './app';
import type { Env } from './config/env';

const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 3000;
const LOGIN_IP_LIMIT = { windowMs: 60_000, limit: 20 };
const LOGIN_CPF_LIMIT = { windowMs: 15 * 60_000, limit: 5 };

export type Dependencies = Readonly<{
  app: Express;
  logger: Logger;
  close: () => Promise<void>;
}>;

export type DependencyOverrides = Readonly<{
  logDestination?: DestinationStream;
}>;

export async function createDependencies(
  env: Env,
  overrides: DependencyOverrides = {},
): Promise<Dependencies> {
  const logger = createLogger(env.logLevel, overrides.logDestination);
  const prisma = createPrismaClient(env.database, logger);
  const clock = new SystemClock();
  const [passwordHasher, accessTokens] = await Promise.all([
    BcryptPasswordHasher.create(env.auth.bcryptCost),
    JoseAccessTokenService.create(
      {
        privateKeyPem: env.auth.privateKeyPem,
        publicKeyPem: env.auth.publicKeyPem,
        issuer: env.auth.issuer,
        audience: env.auth.audience,
        ttlSeconds: env.auth.accessTokenTtlSeconds,
      },
      clock,
    ),
  ]);
  const guardians = new PrismaGuardianRepository(prisma);
  const sessions = new PrismaSessionRepository(prisma);

  const login = createLogin({
    guardians,
    sessions,
    passwordHasher,
    refreshTokens: new CryptoRefreshTokenGenerator(),
    accessTokens,
    clock,
    refreshTokenTtlSeconds: env.auth.refreshTokenTtlSeconds,
  });
  const loginController = new LoginController(login, logger, cpf =>
    cpfRateLimitKey(cpf, env.auth.cpfHmacSecret),
  );

  const app = createApp({
    logger,
    requestLogger: createHttpLogger(logger),
    security: {
      trustProxy: env.http.trustProxy,
      enforceHttps: env.nodeEnv === 'production',
      corsOrigins: env.http.corsOrigins,
    },
    routers: [
      healthRoutes(
        new HealthController(
          new PrismaDatabaseHealthCheck(
            prisma,
            HEALTH_CHECK_TIMEOUT_MILLISECONDS,
          ),
        ),
      ),
      authRoutes({
        loginController,
        loginIpLimit: createIpRateLimit(LOGIN_IP_LIMIT, logger),
        loginCpfLimit: createCpfRateLimit(
          LOGIN_CPF_LIMIT,
          env.auth.cpfHmacSecret,
          logger,
        ),
      }),
    ],
  });

  return { app, logger, close: () => prisma.$disconnect() };
}
