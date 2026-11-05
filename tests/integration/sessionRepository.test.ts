import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaSessionRepository } from '@/infra/database/repositories/PrismaSessionRepository';
import { CryptoRefreshTokenGenerator } from '@/infra/security/CryptoRefreshTokenGenerator';
import { loadDatabaseEnv } from '@/main/config/env';
import { loadSourceForTests } from '../support/seedSourceForTests';

const logger = { info: jest.fn(), error: jest.fn() };
const prisma = createPrismaClient(
  loadDatabaseEnv(process.env).database,
  logger,
);
const sessions = new PrismaSessionRepository(prisma);
const generator = new CryptoRefreshTokenGenerator();
const [firstGuardian, secondGuardian] = loadSourceForTests().map(g => g.id);
const now = new Date('2026-11-05T12:00:00.000Z');
const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

afterAll(() => prisma.$disconnect());

async function openSession(guardianId = firstGuardian!) {
  const refresh = generator.generate();
  const session = await sessions.create(guardianId, {
    hash: refresh.hash,
    expiresAt: inThirtyDays,
  });
  return { session, refresh };
}

describe('PrismaSessionRepository.create', () => {
  it('abre uma sessão ativa com o primeiro refresh ligado a ela', async () => {
    const { session, refresh } = await openSession();

    expect(session.guardianId).toBe(firstGuardian);
    expect(session.revokedAt).toBeNull();
    const found = await sessions.findByRefreshHash(refresh.hash);
    expect(found?.session.id).toBe(session.id);
    expect(found?.token).toMatchObject({
      sessionId: session.id,
      usedAt: null,
      expiresAt: inThirtyDays,
    });
  });

  it('guarda só o hash do refresh token, nunca o valor', async () => {
    const { session, refresh } = await openSession();

    const rows = await prisma.refreshToken.findMany({
      where: { sessionId: session.id },
      select: { tokenHash: true },
    });
    expect(rows).toEqual([{ tokenHash: refresh.hash }]);
    await expect(
      prisma.refreshToken.count({ where: { tokenHash: refresh.token } }),
    ).resolves.toBe(0);
  });
});

describe('PrismaSessionRepository.findActive', () => {
  it('encontra a sessão ativa do próprio responsável', async () => {
    const { session } = await openSession();

    await expect(
      sessions.findActive(session.id, firstGuardian!),
    ).resolves.toMatchObject({ id: session.id });
  });

  it('não encontra a sessão quando o responsável é outro', async () => {
    const { session } = await openSession();

    await expect(
      sessions.findActive(session.id, secondGuardian!),
    ).resolves.toBeNull();
  });

  it('não encontra a sessão revogada', async () => {
    const { session } = await openSession();
    await sessions.revoke(session.id, 'logout', now);

    await expect(
      sessions.findActive(session.id, firstGuardian!),
    ).resolves.toBeNull();
  });
});

describe('PrismaSessionRepository.findByRefreshHash', () => {
  it('devolve null para hash desconhecido', async () => {
    await expect(
      sessions.findByRefreshHash(generator.generate().hash),
    ).resolves.toBeNull();
  });
});

describe('PrismaSessionRepository.rotate', () => {
  it('marca o atual como usado, cria o próximo na mesma sessão e encadeia os dois', async () => {
    const { session, refresh } = await openSession();
    const next = generator.generate();
    const current = await sessions.findByRefreshHash(refresh.hash);

    await expect(
      sessions.rotate(
        current!.token.id,
        { hash: next.hash, expiresAt: inThirtyDays },
        now,
      ),
    ).resolves.toBe(true);

    const used = await sessions.findByRefreshHash(refresh.hash);
    const created = await sessions.findByRefreshHash(next.hash);
    expect(used?.token.usedAt).toEqual(now);
    expect(created?.token).toMatchObject({
      sessionId: session.id,
      usedAt: null,
    });
    expect(created?.session.lastUsedAt).toEqual(now);
    const chain = await prisma.refreshToken.findUnique({
      where: { id: current!.token.id },
      select: { replacedBy: true },
    });
    expect(chain?.replacedBy).toBe(created?.token.id);
  });

  it('não gira de novo um token já usado (reuso)', async () => {
    const { refresh } = await openSession();
    const current = await sessions.findByRefreshHash(refresh.hash);
    await sessions.rotate(
      current!.token.id,
      { hash: generator.generate().hash, expiresAt: inThirtyDays },
      now,
    );

    await expect(
      sessions.rotate(
        current!.token.id,
        { hash: generator.generate().hash, expiresAt: inThirtyDays },
        now,
      ),
    ).resolves.toBe(false);
  });

  it('é atômica: se a criação do próximo falha, o atual continua sem uso', async () => {
    const { refresh } = await openSession();
    const other = await openSession();
    const current = await sessions.findByRefreshHash(refresh.hash);

    await expect(
      sessions.rotate(
        current!.token.id,
        { hash: other.refresh.hash, expiresAt: inThirtyDays },
        now,
      ),
    ).rejects.toThrow();

    const after = await sessions.findByRefreshHash(refresh.hash);
    expect(after?.token.usedAt).toBeNull();
  });
});

describe('PrismaSessionRepository.revoke', () => {
  it('revoga com data e motivo, e é idempotente', async () => {
    const { session, refresh } = await openSession();
    const later = new Date(now.getTime() + 60_000);

    await sessions.revoke(session.id, 'reuso', now);
    await sessions.revoke(session.id, 'logout', later);

    const found = await sessions.findByRefreshHash(refresh.hash);
    expect(found?.session).toMatchObject({
      revokedAt: now,
      revokedReason: 'reuso',
    });
  });

  it('revogar uma sessão não afeta outra do mesmo responsável', async () => {
    const phone = await openSession();
    const tablet = await openSession();

    await sessions.revoke(phone.session.id, 'logout', now);

    await expect(
      sessions.findActive(tablet.session.id, firstGuardian!),
    ).resolves.toMatchObject({ id: tablet.session.id });
  });
});
