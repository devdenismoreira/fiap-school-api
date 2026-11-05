import request from 'supertest';
import { HealthController } from '@/presentation/controllers/HealthController';
import { healthRoutes } from '@/presentation/routes/healthRoutes';
import { createApp, type AppSecurity } from './app';

const DEVELOPMENT: AppSecurity = {
  trustProxy: 0,
  enforceHttps: false,
  corsOrigins: [],
};

function buildApp(
  isAvailable: () => Promise<boolean>,
  security: AppSecurity = DEVELOPMENT,
) {
  const logger = { info: jest.fn(), error: jest.fn() };
  const requestLogger = jest.fn<void, [unknown, unknown, () => void]>(
    (_request, _response, next) => next(),
  );
  const app = createApp({
    logger,
    requestLogger,
    routers: [healthRoutes(new HealthController({ isAvailable }))],
    security,
  });
  return { app, logger, requestLogger };
}

describe('HSTS', () => {
  it('não envia Strict-Transport-Security fora de produção', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/health');

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('envia HSTS de 1 ano com includeSubDomains em produção, sem preload', async () => {
    const { app } = buildApp(() => Promise.resolve(true), {
      trustProxy: 1,
      enforceHttps: true,
      corsOrigins: [],
    });

    const response = await request(app)
      .get('/health')
      .set('X-Forwarded-Proto', 'https');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

describe('registro das requisições', () => {
  it('passa toda requisição pelo logger HTTP', async () => {
    const { app, requestLogger } = buildApp(() => Promise.resolve(true));

    await request(app).get('/health');

    expect(requestLogger).toHaveBeenCalledTimes(1);
  });
});

describe('GET /health', () => {
  it('responde 200 com status ok quando o banco responde', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('responde 503 com status indisponivel quando o banco não responde', async () => {
    const { app } = buildApp(() => Promise.resolve(false));

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'indisponivel' });
  });
});

describe('cabeçalhos de segurança', () => {
  it('não envia x-powered-by', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('aplica os cabeçalhos do helmet', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });
});

describe('rota inexistente', () => {
  it('responde 404 NAO_ENCONTRADO no formato de erro do contrato', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/v1/nao-existe');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Recurso não encontrado.' },
    });
  });
});

describe('corpo da requisição', () => {
  const invalidData = {
    erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.' },
  };

  it('responde 400 DADOS_INVALIDOS para JSON malformado', async () => {
    const { app, logger } = buildApp(() => Promise.resolve(true));

    const response = await request(app)
      .post('/v1/qualquer')
      .set('Content-Type', 'application/json')
      .send('{"cpf":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidData);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('responde 400 DADOS_INVALIDOS para corpo acima de 10 KB', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app)
      .post('/v1/qualquer')
      .send({ texto: 'a'.repeat(11 * 1024) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidData);
  });
});

describe('Cache-Control das rotas /v1', () => {
  it('envia no-store em toda resposta sob /v1, inclusive 404 e JSON malformado', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const notFound = await request(app).get('/v1/nao-existe');
    const malformed = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"cpf":');

    expect(notFound.headers['cache-control']).toBe('no-store');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['cache-control']).toBe('no-store');
  });

  it('não muda o /health', async () => {
    const { app } = buildApp(() => Promise.resolve(true));

    const response = await request(app).get('/health');

    expect(response.headers['cache-control']).toBeUndefined();
  });
});
