import { Router, type RequestHandler } from 'express';
import type { LoginController } from '@/presentation/controllers/LoginController';
import { validate } from '@/presentation/middlewares/validate';
import { loginSchema } from '@/presentation/schemas/authSchemas';

export type AuthRoutesDependencies = Readonly<{
  loginController: LoginController;
  loginIpLimit: RequestHandler;
  loginCpfLimit: RequestHandler;
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
  return router;
}
