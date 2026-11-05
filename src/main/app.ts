import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '@/domain/ports/Logger';
import { createCors } from '@/presentation/middlewares/cors';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import { noStore } from '@/presentation/middlewares/noStore';
import { notFoundHandler } from '@/presentation/middlewares/notFoundHandler';
import { createRequireHttps } from '@/presentation/middlewares/requireHttps';

const HSTS_MAX_AGE_SECONDS = 31_536_000;

export type AppSecurity = Readonly<{
  trustProxy: number;
  enforceHttps: boolean;
  corsOrigins: readonly string[];
}>;

export type AppDependencies = Readonly<{
  logger: Logger;
  requestLogger: RequestHandler;
  routers: readonly RequestHandler[];
  security: AppSecurity;
}>;

export function createApp(dependencies: AppDependencies): Express {
  const { logger, security } = dependencies;
  const app = express();
  app.set('trust proxy', security.trustProxy);
  app.disable('x-powered-by');
  app.use(createRequireHttps(security.enforceHttps, logger));
  app.use(
    helmet({
      strictTransportSecurity: security.enforceHttps
        ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true }
        : false,
    }),
  );
  app.use(createCors(security.corsOrigins));
  app.use('/v1', noStore);
  app.use(express.json({ limit: '10kb' }));
  app.use(dependencies.requestLogger);
  for (const router of dependencies.routers) {
    app.use(router);
  }
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
