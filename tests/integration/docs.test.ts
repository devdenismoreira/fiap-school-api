import request from 'supertest';
import { loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';

const env = loadEnv(process.env);

describe('Swagger em /docs', () => {
  it('responde fora de produção, com o openapi.yaml', async () => {
    const api: Dependencies = await createDependencies({
      ...env,
      nodeEnv: 'development',
    });
    try {
      const page = await request(api.app).get('/docs/');
      const spec = await request(api.app).get('/docs/openapi.yaml');

      expect(page.status).toBe(200);
      expect(page.text).toContain('swagger-ui');
      expect(spec.status).toBe(200);
      expect(spec.text).toContain('openapi: 3.1.0');
    } finally {
      await api.close();
    }
  });

  it('não existe em produção: 404', async () => {
    const api: Dependencies = await createDependencies({
      ...env,
      nodeEnv: 'production',
      http: { ...env.http, trustProxy: 1 },
    });
    try {
      for (const path of ['/docs/', '/docs/openapi.yaml']) {
        const response = await request(api.app)
          .get(path)
          .set('X-Forwarded-Proto', 'https');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          erro: {
            codigo: 'NAO_ENCONTRADO',
            mensagem: 'Recurso não encontrado.',
          },
        });
      }
    } finally {
      await api.close();
    }
  });
});
