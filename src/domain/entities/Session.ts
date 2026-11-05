export type SessionRevocationReason = 'logout' | 'reuso';

export type Session = Readonly<{
  id: string;
  guardianId: number;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevocationReason | null;
}>;

export function isSessionActive(session: Session): boolean {
  return session.revokedAt === null;
}
