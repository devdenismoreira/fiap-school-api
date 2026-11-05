import type { Request, Response } from 'express';
import type { Logout } from '@/domain/usecases/logout';
import type { RefreshSession } from '@/domain/usecases/refreshSession';
import type { RefreshBody } from '@/presentation/schemas/authSchemas';
import { tokensView } from '@/presentation/views/tokensView';

export class SessionController {
  constructor(
    private readonly refreshSession: RefreshSession,
    private readonly logout: Logout,
  ) {}

  readonly refresh = async (request: Request, response: Response) => {
    const { refreshToken } = request.body as RefreshBody;
    const tokens = await this.refreshSession(refreshToken);
    response.status(200).json(tokensView(tokens));
  };

  readonly end = async (request: Request, response: Response) => {
    const { refreshToken } = request.body as RefreshBody;
    await this.logout(refreshToken);
    response.status(204).end();
  };
}
