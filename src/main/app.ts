import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '@/domain/ports/Logger';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import { noStore } from '@/presentation/middlewares/noStore';
import { notFoundHandler } from '@/presentation/middlewares/notFoundHandler';

export type AppDependencies = Readonly<{
  logger: Logger;
  requestLogger: RequestHandler;
  routers: readonly RequestHandler[];
}>;

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/v1', noStore);
  app.use(express.json({ limit: '10kb' }));
  app.use(dependencies.requestLogger);
  for (const router of dependencies.routers) {
    app.use(router);
  }
  app.use(notFoundHandler);
  app.use(createErrorHandler(dependencies.logger));
  return app;
}
