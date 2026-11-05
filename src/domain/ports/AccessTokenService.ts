export type AccessTokenClaims = Readonly<{
  guardianId: number;
  sessionId: string;
}>;

export type IssuedAccessToken = Readonly<{
  token: string;
  expiresInSeconds: number;
}>;

export interface AccessTokenService {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
  verify(token: string): Promise<AccessTokenClaims>;
}
