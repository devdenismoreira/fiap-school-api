import express from 'express';
import { resolve } from 'node:path';
import request from 'supertest';
import { docsRoutes } from './docsRoutes';

const OPENAPI_PATH = resolve(__dirname, '..', '..', '..', 'openapi.yaml');

function app() {
  const instance = express();
  instance.use(docsRoutes(OPENAPI_PATH));
  return instance;
}

describe('docsRoutes', () => {
  it('serve o Swagger UI em /docs/', async () => {
    const response = await request(app()).get('/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('swagger-ui');
  });

  it('carrega os scripts só de arquivos da própria origem, compatível com o CSP do helmet', async () => {
    const response = await request(app()).get('/docs/');
    const scripts = response.text.match(/<script[^>]*>/g) ?? [];

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script).toMatch(/src="\.\/[^"]+\.js"/);
    }
  });

  it('aponta o Swagger UI para o openapi.yaml', async () => {
    const init = await request(app()).get('/docs/swagger-ui-init.js');

    expect(init.status).toBe(200);
    expect(init.text).toContain('/docs/openapi.yaml');
  });

  it('serve o openapi.yaml cru', async () => {
    const response = await request(app()).get('/docs/openapi.yaml');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/yaml');
    expect(response.text).toContain('openapi: 3.1.0');
  });
});
