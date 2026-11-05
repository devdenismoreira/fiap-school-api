import express from 'express';
import request from 'supertest';
import { createRequireHttps } from './requireHttps';

function app(enabled: boolean, trustProxy: number) {
  const logger = { info: jest.fn(), error: jest.fn() };
  const instance = express();
  instance.set('trust proxy', trustProxy);
  instance.use(createRequireHttps(enabled, logger));
  instance.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  instance.post('/v1/auth/login', (_request, response) => {
    response.json({ ok: true });
  });
  return { instance, logger };
}

describe('requireHttps', () => {
  it('em produção, recusa HTTP com 403 HTTPS_OBRIGATORIO, sem redirecionar', async () => {
    const { instance, logger } = app(true, 1);

    const response = await request(instance)
      .post('/v1/auth/login')
      .set('X-Forwarded-Proto', 'http')
      .send({ cpf: '86686328685', senha: 'x' });

    expect(response.status).toBe(403);
    expect(response.headers.location).toBeUndefined();
    expect(response.body).toEqual({
      erro: { codigo: 'HTTPS_OBRIGATORIO', mensagem: 'HTTPS obrigatório.' },
    });
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'http_recusado', metodo: 'POST', rota: '/v1/auth/login' },
      'Requisição sem TLS recusada',
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('86686328685');
  });

  it('em produção, aceita a requisição que chegou por HTTPS ao proxy de confiança', async () => {
    const { instance } = app(true, 1);

    const response = await request(instance)
      .post('/v1/auth/login')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(200);
  });

  it('não confia no X-Forwarded-Proto quando não há proxy de confiança', async () => {
    const { instance } = app(true, 0);

    const response = await request(instance)
      .post('/v1/auth/login')
      .set('X-Forwarded-Proto', 'https');

    expect(response.status).toBe(403);
  });

  it('libera o /health por HTTP, para a verificação da plataforma', async () => {
    const { instance } = app(true, 1);

    const response = await request(instance)
      .get('/health')
      .set('X-Forwarded-Proto', 'http');

    expect(response.status).toBe(200);
  });

  it('fora de produção, não interfere', async () => {
    const { instance } = app(false, 0);

    const response = await request(instance).post('/v1/auth/login');

    expect(response.status).toBe(200);
  });
});
