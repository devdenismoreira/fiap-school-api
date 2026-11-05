import type { LoginResult } from '@/domain/usecases/login';
import type { SessionTokens } from '@/domain/usecases/sessionTokens';
import { guardianView, type GuardianView } from './guardianView';

export type TokensView = Readonly<{
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}>;

export type LoginView = TokensView & Readonly<{ responsavel: GuardianView }>;

export function tokensView(tokens: SessionTokens): TokensView {
  return {
    accessToken: tokens.accessToken,
    tokenType: 'Bearer',
    expiresIn: tokens.accessTokenExpiresIn,
    refreshToken: tokens.refreshToken,
    refreshExpiresIn: tokens.refreshTokenExpiresIn,
  };
}

export function loginView(result: LoginResult): LoginView {
  return {
    ...tokensView(result.tokens),
    responsavel: guardianView(result.guardian),
  };
}
