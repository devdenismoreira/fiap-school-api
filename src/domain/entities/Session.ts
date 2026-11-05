export type SessionRevocationReason = 'logout' | 'reuso';

export type Session = Readonly<{
  id: string;
  guardianId: number;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevocationReason | null;
}>;

export const SESSION_USE_RECORD_INTERVAL_MS = 60_000;

export function isSessionActive(session: Session): boolean {
  return session.revokedAt === null;
}

export function shouldRecordSessionUse(session: Session, now: Date): boolean {
  return (
    now.getTime() - session.lastUsedAt.getTime() >=
    SESSION_USE_RECORD_INTERVAL_MS
  );
}
