import type { Express } from 'express';
import { resolve } from 'node:path';
import type { DestinationStream } from 'pino';
import type { Clock } from '@/domain/ports/Clock';
import type { Logger } from '@/domain/ports/Logger';
import { createAuthenticate } from '@/domain/usecases/authenticate';
import { createGetCurrentGuardian } from '@/domain/usecases/getCurrentGuardian';
import { createLogin } from '@/domain/usecases/login';
import { createLogout } from '@/domain/usecases/logout';
import { createRefreshSession } from '@/domain/usecases/refreshSession';
import {
  createGetStudentReportCards,
  createGetStudentSchedule,
} from '@/domain/usecases/studentRecords';
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
import { MeController } from '@/presentation/controllers/MeController';
import { SessionController } from '@/presentation/controllers/SessionController';
import { StudentController } from '@/presentation/controllers/StudentController';
import {
  cpfRateLimitKey,
  createCpfRateLimit,
  createIpRateLimit,
} from '@/presentation/middlewares/rateLimit';
import { createRequireAuth } from '@/presentation/middlewares/requireAuth';
import { authRoutes } from '@/presentation/routes/authRoutes';
import { docsRoutes } from '@/presentation/routes/docsRoutes';
import { healthRoutes } from '@/presentation/routes/healthRoutes';
import { meRoutes } from '@/presentation/routes/meRoutes';
import { studentRoutes } from '@/presentation/routes/studentRoutes';
import { createApp } from './app';
import type { Env } from './config/env';

const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 3000;
const OPENAPI_PATH = resolve(__dirname, '..', '..', 'openapi.yaml');
const LOGIN_IP_LIMIT = { windowMs: 60_000, limit: 20 };
const LOGIN_CPF_LIMIT = { windowMs: 15 * 60_000, limit: 5 };
const AUTHENTICATED_IP_LIMIT = { windowMs: 60_000, limit: 120 };
const SESSION_IP_LIMIT = { windowMs: 60_000, limit: 30 };

export type Dependencies = Readonly<{
  app: Express;
  logger: Logger;
  close: () => Promise<void>;
}>;

export type DependencyOverrides = Readonly<{
  logDestination?: DestinationStream;
  clock?: Clock;
}>;

export async function createDependencies(
  env: Env,
  overrides: DependencyOverrides = {},
): Promise<Dependencies> {
  const logger = createLogger(env.logLevel, overrides.logDestination);
  const prisma = createPrismaClient(env.database, logger);
  const clock = overrides.clock ?? new SystemClock();
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
  const refreshTokens = new CryptoRefreshTokenGenerator();

  const login = createLogin({
    guardians,
    sessions,
    passwordHasher,
    refreshTokens,
    accessTokens,
    clock,
    refreshTokenTtlSeconds: env.auth.refreshTokenTtlSeconds,
  });
  const loginController = new LoginController(login, logger, cpf =>
    cpfRateLimitKey(cpf, env.auth.cpfHmacSecret),
  );
  const sessionController = new SessionController(
    createRefreshSession({
      sessions,
      refreshTokens,
      accessTokens,
      clock,
      logger,
      refreshTokenTtlSeconds: env.auth.refreshTokenTtlSeconds,
    }),
    createLogout({ sessions, refreshTokens, clock, logger }),
  );
  const requireAuth = createRequireAuth(
    createAuthenticate({ accessTokens, sessions, clock }),
  );
  const authenticatedIpLimit = createIpRateLimit(
    AUTHENTICATED_IP_LIMIT,
    logger,
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
        sessionController,
        sessionIpLimit: createIpRateLimit(SESSION_IP_LIMIT, logger),
        loginIpLimit: createIpRateLimit(LOGIN_IP_LIMIT, logger),
        loginCpfLimit: createCpfRateLimit(
          LOGIN_CPF_LIMIT,
          env.auth.cpfHmacSecret,
          logger,
        ),
      }),
      meRoutes({
        meController: new MeController(createGetCurrentGuardian(guardians)),
        authenticatedIpLimit,
        requireAuth,
      }),
      studentRoutes({
        studentController: new StudentController(
          createGetStudentSchedule({ guardians, logger }),
          createGetStudentReportCards({ guardians, logger }),
        ),
        authenticatedIpLimit,
        requireAuth,
      }),
      docsRoutes(OPENAPI_PATH),
    ],
  });

  return { app, logger, close: () => prisma.$disconnect() };
}
