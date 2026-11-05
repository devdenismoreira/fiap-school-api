import type { DatabaseHealthCheck } from '@/domain/ports/DatabaseHealthCheck';
import type { PrismaClient } from './generated/prisma/client';

function rejectAfter(milliseconds: number): {
  promise: Promise<never>;
  cancel: () => void;
} {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('Tempo esgotado na verificação do banco')),
      milliseconds,
    );
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

export class PrismaDatabaseHealthCheck implements DatabaseHealthCheck {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly timeoutMilliseconds: number,
  ) {}

  async isAvailable(): Promise<boolean> {
    const timeout = rejectAfter(this.timeoutMilliseconds);
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout.promise]);
      return true;
    } catch {
      return false;
    } finally {
      timeout.cancel();
    }
  }
}
