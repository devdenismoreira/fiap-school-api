import type { RefreshToken } from '@/domain/entities/RefreshToken';
import type {
  Session,
  SessionRevocationReason,
} from '@/domain/entities/Session';

export type NewRefreshToken = Readonly<{
  hash: string;
  expiresAt: Date;
}>;

export type RefreshTokenWithSession = Readonly<{
  token: RefreshToken;
  session: Session;
}>;

export interface SessionRepository {
  create(guardianId: number, refreshToken: NewRefreshToken): Promise<Session>;
  findActive(sessionId: string, guardianId: number): Promise<Session | null>;
  findByRefreshHash(hash: string): Promise<RefreshTokenWithSession | null>;
  rotate(
    currentTokenId: string,
    next: NewRefreshToken,
    now: Date,
  ): Promise<boolean>;
  revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<void>;
  recordUse(sessionId: string, now: Date): Promise<void>;
}
