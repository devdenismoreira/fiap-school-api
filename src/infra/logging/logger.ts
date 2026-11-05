import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  pino,
  type DestinationStream,
  type LevelWithSilent,
  type Logger as PinoLogger,
  type LoggerOptions,
} from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.cpf',
  'req.body.senha',
  'req.body.refreshToken',
  '*.cpf',
  '*.senha',
  '*.accessToken',
  '*.refreshToken',
  'DATABASE_URL',
  'DIRECT_URL',
  '*.DATABASE_URL',
  '*.DIRECT_URL',
];

const CENSOR = '[oculto]';

export function createLogger(
  level: LevelWithSilent,
  destination?: DestinationStream,
): PinoLogger {
  const options: LoggerOptions = {
    level,
    redact: { paths: REDACTED_PATHS, censor: CENSOR },
  };
  return destination ? pino(options, destination) : pino(options);
}

function levelFor(
  _request: IncomingMessage,
  response: ServerResponse,
  error?: Error,
): LevelWithSilent {
  if (error || response.statusCode >= 500) {
    return 'error';
  }
  return response.statusCode >= 400 ? 'warn' : 'info';
}

export function createHttpLogger(logger: PinoLogger): HttpLogger {
  return pinoHttp({ logger, customLogLevel: levelFor });
}
