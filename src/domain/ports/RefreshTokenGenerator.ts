export type GeneratedRefreshToken = Readonly<{
  token: string;
  hash: string;
}>;

export interface RefreshTokenGenerator {
  generate(): GeneratedRefreshToken;
  hash(token: string): string;
}
