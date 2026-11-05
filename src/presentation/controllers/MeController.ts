import type { Request, Response } from 'express';
import type { GetCurrentGuardian } from '@/domain/usecases/getCurrentGuardian';
import { authenticatedContext } from '@/presentation/middlewares/requireAuth';
import { guardianView } from '@/presentation/views/guardianView';

export class MeController {
  constructor(private readonly getCurrentGuardian: GetCurrentGuardian) {}

  readonly show = async (_request: Request, response: Response) => {
    const { guardianId } = authenticatedContext(response);
    const guardian = await this.getCurrentGuardian(guardianId);
    response.status(200).json(guardianView(guardian));
  };
}
