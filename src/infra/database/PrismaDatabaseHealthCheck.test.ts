import type { PrismaClient } from './generated/prisma/client';
import { createPrismaClient } from './prismaClient';
import { PrismaDatabaseHealthCheck } from './PrismaDatabaseHealthCheck';

function fakePrisma(queryRaw: () => Promise<unknown>): PrismaClient {
  return { $queryRaw: queryRaw } as unknown as PrismaClient;
}

describe('PrismaDatabaseHealthCheck', () => {
  it('devolve true quando a consulta responde', async () => {
    const healthCheck = new PrismaDatabaseHealthCheck(
      fakePrisma(() => Promise.resolve([{ ok: 1 }])),
      1000,
    );

    await expect(healthCheck.isAvailable()).resolves.toBe(true);
  });

  it('devolve false quando a consulta falha', async () => {
    const healthCheck = new PrismaDatabaseHealthCheck(
      fakePrisma(() => Promise.reject(new Error('falha'))),
      1000,
    );

    await expect(healthCheck.isAvailable()).resolves.toBe(false);
  });

  it('devolve false quando o banco não responde dentro do tempo limite', async () => {
    const healthCheck = new PrismaDatabaseHealthCheck(
      fakePrisma(() => new Promise(() => undefined)),
      20,
    );

    await expect(healthCheck.isAvailable()).resolves.toBe(false);
  });

  it('devolve false com o cliente real quando o banco recusa a conexão', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const prisma = createPrismaClient(
      {
        url: 'postgresql://usuario:senha@127.0.0.1:1/postgres?schema=fiap_school_test&sslmode=verify-full',
        schema: 'fiap_school_test',
      },
      logger,
    );

    try {
      await expect(prisma.$queryRaw`SELECT 1`).rejects.toThrow(
        "Can't reach database server",
      );
      await expect(
        new PrismaDatabaseHealthCheck(prisma, 2000).isAvailable(),
      ).resolves.toBe(false);
    } finally {
      await prisma.$disconnect();
    }
  });
});
