import { Router, type RequestHandler } from 'express';
import type { StudentController } from '@/presentation/controllers/StudentController';
import { validate } from '@/presentation/middlewares/validate';
import { studentParamsSchema } from '@/presentation/schemas/studentSchemas';

export type StudentRoutesDependencies = Readonly<{
  studentController: StudentController;
  authenticatedIpLimit: RequestHandler;
  requireAuth: RequestHandler;
}>;

export function studentRoutes(dependencies: StudentRoutesDependencies): Router {
  const router = Router();
  const guards = [
    dependencies.authenticatedIpLimit,
    dependencies.requireAuth,
    validate({ params: studentParamsSchema }),
  ];
  router.get(
    '/v1/alunos/:rm/agenda',
    ...guards,
    dependencies.studentController.schedule,
  );
  router.get(
    '/v1/alunos/:rm/boletins',
    ...guards,
    dependencies.studentController.reportCards,
  );
  return router;
}
