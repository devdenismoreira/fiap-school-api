import request from 'supertest';
import { loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';

const env = loadEnv(process.env);

describe('Swagger em /docs', () => {
  it('responde em desenvolvimento, com o openapi.yaml', async () => {
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

  describe('em produção (D-14, revisada na T11)', () => {
    let api: Dependencies;
    beforeAll(async () => {
      api = await createDependencies({
        ...env,
        nodeEnv: 'production',
        http: { ...env.http, trustProxy: 1 },
      });
    });
    afterAll(() => api.close());

    it('responde por HTTPS, com o openapi.yaml', async () => {
      const page = await request(api.app)
        .get('/docs/')
        .set('X-Forwarded-Proto', 'https');
      const spec = await request(api.app)
        .get('/docs/openapi.yaml')
        .set('X-Forwarded-Proto', 'https');

      expect(page.status).toBe(200);
      expect(page.text).toContain('swagger-ui');
      expect(spec.status).toBe(200);
      expect(spec.text).toContain('openapi: 3.1.0');
    });

    it('recusa HTTP com 403 HTTPS_OBRIGATORIO, como o resto da API', async () => {
      const response = await request(api.app)
        .get('/docs/')
        .set('X-Forwarded-Proto', 'http');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        erro: { codigo: 'HTTPS_OBRIGATORIO', mensagem: 'HTTPS obrigatório.' },
      });
    });

    it('aponta o "Try it out" para o próprio host (servers relativo)', async () => {
      const spec = await request(api.app)
        .get('/docs/openapi.yaml')
        .set('X-Forwarded-Proto', 'https');

      expect(spec.text).toMatch(/servers:\n\s+- url: \/\n/);
    });
  });
});
