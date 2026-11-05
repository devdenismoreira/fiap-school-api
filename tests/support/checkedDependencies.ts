import express from 'express';
import type { Env } from '@/main/config/env';
import {
  createDependencies as createApiDependencies,
  type Dependencies,
  type DependencyOverrides,
} from '@/main/dependencies';
import { contractInspector } from './contractChecker';

export async function createDependencies(
  env: Env,
  overrides: DependencyOverrides = {},
): Promise<Dependencies> {
  const dependencies = await createApiDependencies(env, overrides);
  const app = express();
  app.disable('x-powered-by');
  app.use(contractInspector());
  app.use(dependencies.app);
  return { ...dependencies, app };
}
