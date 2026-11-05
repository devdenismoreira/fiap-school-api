import type { RefreshToken } from '@/domain/entities/RefreshToken';
import {
  SESSION_USE_RECORD_INTERVAL_MS,
  type Session,
  type SessionRevocationReason,
} from '@/domain/entities/Session';
import type {
  NewRefreshToken,
  RefreshTokenWithSession,
  SessionRepository,
} from '@/domain/repositories/SessionRepository';
import type { PrismaClient } from '../generated/prisma/client';

type SessionRow = Readonly<{
  id: string;
  guardianId: number;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}>;

type RefreshTokenRow = Readonly<{
  id: string;
  sessionId: string;
  expiresAt: Date;
  usedAt: Date | null;
}>;

function toReason(value: string | null): SessionRevocationReason | null {
  return value === 'logout' || value === 'reuso' ? value : null;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    guardianId: row.guardianId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    revokedReason: toReason(row.revokedReason),
  };
}

function toRefreshToken(row: RefreshTokenRow): RefreshToken {
  return {
    id: row.id,
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
  };
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    guardianId: number,
    refreshToken: NewRefreshToken,
  ): Promise<Session> {
    const row = await this.prisma.session.create({
      data: {
        guardianId,
        refreshTokens: {
          create: {
            tokenHash: refreshToken.hash,
            expiresAt: refreshToken.expiresAt,
          },
        },
      },
    });
    return toSession(row);
  }

  async findActive(
    sessionId: string,
    guardianId: number,
  ): Promise<Session | null> {
    const row = await this.prisma.session.findFirst({
      where: { id: sessionId, guardianId, revokedAt: null },
    });
    return row ? toSession(row) : null;
  }

  async findByRefreshHash(
    hash: string,
  ): Promise<RefreshTokenWithSession | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { session: true },
    });
    return row
      ? { token: toRefreshToken(row), session: toSession(row.session) }
      : null;
  }

  async rotate(
    currentTokenId: string,
    next: NewRefreshToken,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      const marked = await tx.refreshToken.updateMany({
        where: { id: currentTokenId, usedAt: null },
        data: { usedAt: now },
      });
      if (marked.count === 0) {
        return false;
      }
      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { id: currentTokenId },
        select: { sessionId: true },
      });
      const created = await tx.refreshToken.create({
        data: {
          sessionId: current.sessionId,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
        },
        select: { id: true },
      });
      await tx.refreshToken.update({
        where: { id: currentTokenId },
        data: { replacedBy: created.id },
      });
      await tx.session.update({
        where: { id: current.sessionId },
        data: { lastUsedAt: now },
      });
      return true;
    });
  }

  async revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
  }

  async recordUse(sessionId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        lastUsedAt: {
          lte: new Date(now.getTime() - SESSION_USE_RECORD_INTERVAL_MS),
        },
      },
      data: { lastUsedAt: now },
    });
  }
}
