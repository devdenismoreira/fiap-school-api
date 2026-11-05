import { loadEnv } from './config/env';
import { createDependencies } from './dependencies';

function start(): void {
  const env = loadEnv(process.env);
  const { app, logger, close } = createDependencies(env);

  const server = app.listen(env.port, error => {
    if (error) {
      logger.error({ err: error }, 'Falha ao iniciar o servidor');
      process.exitCode = 1;
      return;
    }
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, 'API em execução');
  });

  const shutdown = (): void => {
    server.close(() => {
      void close().finally(() => process.exit());
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

try {
  start();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Falha ao iniciar a API.',
  );
  process.exitCode = 1;
}
