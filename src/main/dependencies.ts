import type { Express } from 'express';
import type { Logger } from '@/domain/ports/Logger';
import { PrismaDatabaseHealthCheck } from '@/infra/database/PrismaDatabaseHealthCheck';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { createLogger } from '@/infra/logging/logger';
import { HealthController } from '@/presentation/controllers/HealthController';
import { createApp } from './app';
import type { Env } from './config/env';

const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 3000;

export type Dependencies = Readonly<{
  app: Express;
  logger: Logger;
  close: () => Promise<void>;
}>;

export function createDependencies(env: Env): Dependencies {
  const logger = createLogger(env.logLevel);
  const prisma = createPrismaClient(env.database, logger);
  const healthController = new HealthController(
    new PrismaDatabaseHealthCheck(prisma, HEALTH_CHECK_TIMEOUT_MILLISECONDS),
  );
  return {
    app: createApp({ logger, healthController }),
    logger,
    close: () => prisma.$disconnect(),
  };
}
