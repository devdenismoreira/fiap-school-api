import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '@/domain/ports/Logger';
import type { HealthController } from '@/presentation/controllers/HealthController';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import { notFoundHandler } from '@/presentation/middlewares/notFoundHandler';
import { healthRoutes } from '@/presentation/routes/healthRoutes';

export type AppDependencies = Readonly<{
  logger: Logger;
  requestLogger: RequestHandler;
  healthController: HealthController;
}>;

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));
  app.use(dependencies.requestLogger);
  app.use(healthRoutes(dependencies.healthController));
  app.use(notFoundHandler);
  app.use(createErrorHandler(dependencies.logger));
  return app;
}
