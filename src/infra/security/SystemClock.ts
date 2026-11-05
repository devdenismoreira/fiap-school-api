import type { Clock } from '@/domain/ports/Clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
