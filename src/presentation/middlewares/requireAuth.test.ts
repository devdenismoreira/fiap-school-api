import express from 'express';
import request from 'supertest';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '@/domain/errors/DomainErrors';
import type { Authenticate } from '@/domain/usecases/authenticate';
import { createErrorHandler } from './errorHandler';
import { authenticatedContext, createRequireAuth } from './requireAuth';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';

function setup(result?: Error) {
  const authenticate = jest.fn<ReturnType<Authenticate>, [string]>(() =>
    result
      ? Promise.reject(result)
      : Promise.resolve({ guardianId: 7, sessionId: SESSION_ID }),
  );
  const app = express();
  app.get(
    '/protegido',
    createRequireAuth(authenticate),
    (_request, response) => {
      response.json(authenticatedContext(response));
    },
  );
  app.use(createErrorHandler({ info: jest.fn(), error: jest.fn() }));
  return { app, authenticate };
}

const invalidToken = {
  erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token de acesso inválido.' },
};

describe('requireAuth', () => {
  it('libera o token autenticado, expondo só guardianId e sessionId', async () => {
    const { app, authenticate } = setup();

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ guardianId: 7, sessionId: SESSION_ID });
    expect(authenticate).toHaveBeenCalledWith('aaa.bbb.ccc');
  });

  it('aceita o esquema Bearer sem diferenciar maiúsculas', async () => {
    const { app } = setup();

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'bearer aaa.bbb.ccc');

    expect(response.status).toBe(200);
  });

  it.each([
    ['sem cabeçalho Authorization', undefined],
    ['com outro esquema', 'Basic dXN1YXJpbzpzZW5oYQ=='],
    ['com Bearer vazio', 'Bearer '],
    ['com dois tokens', 'Bearer aaa.bbb.ccc ddd.eee.fff'],
  ])('recusa %s com 401 TOKEN_INVALIDO', async (_caso, header) => {
    const { app, authenticate } = setup();
    const call = request(app).get('/protegido');
    if (header !== undefined) {
      void call.set('Authorization', header);
    }

    const response = await call;

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('recusa com 401 TOKEN_INVALIDO quando a autenticação falha', async () => {
    const { app } = setup(new InvalidAccessTokenError());

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('recusa token vencido com 401 TOKEN_EXPIRADO', async () => {
    const { app } = setup(new ExpiredAccessTokenError());

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      erro: { codigo: 'TOKEN_EXPIRADO' },
    });
  });
});
