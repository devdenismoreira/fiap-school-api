import { Router, type RequestHandler } from 'express';
import type { MeController } from '@/presentation/controllers/MeController';

export type MeRoutesDependencies = Readonly<{
  meController: MeController;
  authenticatedIpLimit: RequestHandler;
  requireAuth: RequestHandler;
}>;

export function meRoutes(dependencies: MeRoutesDependencies): Router {
  const router = Router();
  router.get(
    '/v1/me',
    dependencies.authenticatedIpLimit,
    dependencies.requireAuth,
    dependencies.meController.show,
  );
  return router;
}
