import { Router, type RequestHandler } from 'express';
import type { LoginController } from '@/presentation/controllers/LoginController';
import type { SessionController } from '@/presentation/controllers/SessionController';
import { validate } from '@/presentation/middlewares/validate';
import { loginSchema, refreshSchema } from '@/presentation/schemas/authSchemas';

export type AuthRoutesDependencies = Readonly<{
  loginController: LoginController;
  sessionController: SessionController;
  loginIpLimit: RequestHandler;
  loginCpfLimit: RequestHandler;
  sessionIpLimit: RequestHandler;
}>;

export function authRoutes(dependencies: AuthRoutesDependencies): Router {
  const router = Router();
  router.post(
    '/v1/auth/login',
    dependencies.loginIpLimit,
    validate({ body: loginSchema }),
    dependencies.loginCpfLimit,
    dependencies.loginController.handle,
  );
  router.post(
    '/v1/auth/refresh',
    dependencies.sessionIpLimit,
    validate({ body: refreshSchema }),
    dependencies.sessionController.refresh,
  );
  router.post(
    '/v1/auth/logout',
    dependencies.sessionIpLimit,
    validate({ body: refreshSchema }),
    dependencies.sessionController.end,
  );
  return router;
}
