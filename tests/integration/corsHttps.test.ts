import request from 'supertest';
import { loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';

const ALLOWED_ORIGIN = 'https://admin.exemplo.com';
const OTHER_ORIGIN = 'https://outro.exemplo.com';

async function startProductionApi(): Promise<Dependencies> {
  const env = loadEnv(process.env);
  return createDependencies({
    ...env,
    nodeEnv: 'production',
    http: { ...env.http, corsOrigins: [ALLOWED_ORIGIN], trustProxy: 1 },
  });
}

function overHttps(api: Dependencies) {
  return {
    get: (path: string) =>
      request(api.app).get(path).set('X-Forwarded-Proto', 'https'),
    post: (path: string) =>
      request(api.app).post(path).set('X-Forwarded-Proto', 'https'),
    options: (path: string) =>
      request(api.app).options(path).set('X-Forwarded-Proto', 'https'),
  };
}

describe('HTTPS em produção, atrás do proxy de confiança', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startProductionApi();
  });
  afterAll(() => api.close());

  it('recusa HTTP com 403 HTTPS_OBRIGATORIO, sem redirecionar', async () => {
    const response = await request(api.app)
      .post('/v1/auth/login')
      .set('X-Forwarded-Proto', 'http')
      .send({});

    expect(response.status).toBe(403);
    expect(response.headers.location).toBeUndefined();
    expect(response.body).toEqual({
      erro: { codigo: 'HTTPS_OBRIGATORIO', mensagem: 'HTTPS obrigatório.' },
    });
  });

  it('libera o /health por HTTP', async () => {
    const response = await request(api.app)
      .get('/health')
      .set('X-Forwarded-Proto', 'http');

    expect(response.status).toBe(200);
  });

  it('responde por HTTPS com HSTS', async () => {
    const response = await overHttps(api).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

describe('CORS na API completa', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startProductionApi();
  });
  afterAll(() => api.close());

  it('origem permitida recebe a própria origem e Vary: Origin', async () => {
    const response = await overHttps(api)
      .post('/v1/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({});

    expect(response.status).toBe(400);
    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.vary).toContain('Origin');
  });

  it('origem fora da lista não recebe cabeçalhos CORS', async () => {
    const response = await overHttps(api)
      .post('/v1/auth/login')
      .set('Origin', OTHER_ORIGIN)
      .send({});

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requisição sem Origin (app nativo) segue normalmente', async () => {
    const response = await overHttps(api).post('/v1/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight de origem não permitida recebe 403', async () => {
    const response = await overHttps(api)
      .options('/v1/auth/login')
      .set('Origin', OTHER_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(403);
  });

  it('preflight de origem permitida responde 204 e não conta no limite de tentativas', async () => {
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const preflight = await overHttps(api)
        .options('/v1/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.50')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');
      expect(preflight.status).toBe(204);
    }

    const login = await overHttps(api)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.50')
      .send({});

    expect(login.status).toBe(400);
  });
});

describe('limite por IP com TRUST_PROXY', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startProductionApi();
  });
  afterAll(() => api.close());

  it('conta pelo IP real do cliente informado pelo proxy, não pelo IP do proxy', async () => {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await overHttps(api)
        .post('/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({})
        .expect(400);
    }

    const sameClient = await overHttps(api)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({});
    const otherClient = await overHttps(api)
      .post('/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.11')
      .send({});

    expect(sameClient.status).toBe(429);
    expect(otherClient.status).toBe(400);
  });
});
