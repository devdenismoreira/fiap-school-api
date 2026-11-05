import express from 'express';
import request from 'supertest';
import { createCors } from './cors';

const ALLOWED = 'https://admin.exemplo.com';

function app() {
  const instance = express();
  instance.use(createCors([ALLOWED]));
  instance.get('/v1/recurso', (_request, response) => {
    response.json({ ok: true });
  });
  instance.post('/v1/recurso', (_request, response) => {
    response.json({ ok: true });
  });
  return instance;
}

describe('createCors', () => {
  it('origem permitida recebe Access-Control-Allow-Origin com a própria origem e Vary: Origin', async () => {
    const response = await request(app())
      .get('/v1/recurso')
      .set('Origin', ALLOWED);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers.vary).toContain('Origin');
    expect(response.headers['access-control-expose-headers']).toBe(
      'Retry-After',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  it.each([
    'https://outro.exemplo.com',
    'http://admin.exemplo.com',
    'https://admin.exemplo.com:8443',
    'https://admin.exemplo.com.atacante.com',
    'null',
  ])('origem fora da lista (%s) não recebe cabeçalhos CORS', async origin => {
    const response = await request(app())
      .get('/v1/recurso')
      .set('Origin', origin);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requisição sem Origin (app nativo, curl) funciona normalmente', async () => {
    const response = await request(app()).post('/v1/recurso').send({});

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight de origem permitida responde 204 com métodos, cabeçalhos e Max-Age', async () => {
    const response = await request(app())
      .options('/v1/recurso')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-methods']).toBe(
      'GET,POST,OPTIONS',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'Authorization,Content-Type',
    );
    expect(response.headers['access-control-max-age']).toBe('600');
  });

  it('preflight de origem não permitida recebe 403 sem corpo e sem cabeçalhos CORS', async () => {
    const response = await request(app())
      .options('/v1/recurso')
      .set('Origin', 'https://outro.exemplo.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(403);
    expect(response.text).toBe('');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('com a lista vazia, nenhuma origem cruzada é aceita', async () => {
    const instance = express();
    instance.use(createCors([]));
    instance.get('/v1/recurso', (_request, response) => {
      response.json({ ok: true });
    });

    const response = await request(instance)
      .get('/v1/recurso')
      .set('Origin', ALLOWED);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
