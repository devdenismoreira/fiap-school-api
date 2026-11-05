import { Router } from 'express';
import type { HealthController } from '@/presentation/controllers/HealthController';

export function healthRoutes(controller: HealthController): Router {
  const router = Router();
  router.get('/health', controller.show);
  return router;
}
