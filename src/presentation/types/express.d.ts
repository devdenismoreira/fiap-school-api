import type { AuthenticatedContext } from '@/presentation/middlewares/requireAuth';

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthenticatedContext;
      params?: unknown;
    }
  }
}

export {};
