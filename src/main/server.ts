import { loadEnv } from './config/env';
import { createDependencies } from './dependencies';
import { createServer } from './httpServer';

async function start(): Promise<void> {
  const env = loadEnv(process.env);
  const { app, logger, close } = await createDependencies(env);
  const server = createServer(app, env.http.tls);

  server.on('error', error => {
    logger.error({ err: error }, 'Falha ao iniciar o servidor');
    process.exitCode = 1;
  });
  server.listen(env.port, () => {
    logger.info(
      { port: env.port, nodeEnv: env.nodeEnv, https: env.http.tls !== null },
      'API em execução',
    );
  });

  const shutdown = (): void => {
    server.close(() => {
      void close().finally(() => process.exit());
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Falha ao iniciar a API.',
  );
  process.exitCode = 1;
});
