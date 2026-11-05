import { pino, type LevelWithSilent } from 'pino';
import type { Logger } from '@/domain/ports/Logger';

export function createLogger(level: LevelWithSilent): Logger {
  return pino({ level });
}
