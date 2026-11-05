export type RefreshToken = Readonly<{
  id: string;
  sessionId: string;
  expiresAt: Date;
  usedAt: Date | null;
}>;

export function isRefreshTokenUsed(token: RefreshToken): boolean {
  return token.usedAt !== null;
}

export function isRefreshTokenExpired(token: RefreshToken, now: Date): boolean {
  return token.expiresAt.getTime() <= now.getTime();
}
