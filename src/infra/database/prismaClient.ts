import { PrismaPg } from '@prisma/adapter-pg';
import type { Logger } from '@/domain/ports/Logger';
import { PrismaClient } from './generated/prisma/client';

export type DatabaseConfig = Readonly<{ url: string; schema: string }>;

export function createPrismaClient(
  config: DatabaseConfig,
  logger: Logger,
): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString: config.url },
    {
      schema: config.schema,
      onPoolError: error =>
        logger.error(
          { errorName: error.name },
          'Erro no pool de conexões do banco',
        ),
    },
  );
  return new PrismaClient({ adapter });
}
