import type { Request, Response } from 'express';
import type { DatabaseHealthCheck } from '@/domain/ports/DatabaseHealthCheck';
import { healthView } from '@/presentation/views/healthView';

export class HealthController {
  constructor(private readonly databaseHealthCheck: DatabaseHealthCheck) {}

  readonly show = async (_request: Request, response: Response) => {
    const available = await this.databaseHealthCheck.isAvailable();
    response.status(available ? 200 : 503).json(healthView(available));
  };
}
