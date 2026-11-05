import request from 'supertest';
import { loadEnv } from '@/main/config/env';
import { createDependencies, type Dependencies } from '@/main/dependencies';

describe('GET /health com o banco de teste no Supabase', () => {
  let dependencies: Dependencies;

  beforeAll(async () => {
    dependencies = await createDependencies(loadEnv(process.env));
  });

  afterAll(() => dependencies.close());

  it('responde 200 quando o banco responde', async () => {
    const response = await request(dependencies.app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
