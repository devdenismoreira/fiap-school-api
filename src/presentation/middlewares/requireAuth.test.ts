import express from 'express';
import request from 'supertest';
import type { Session } from '@/domain/entities/Session';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '@/domain/errors/DomainErrors';
import type { AccessTokenService } from '@/domain/ports/AccessTokenService';
import type { SessionRepository } from '@/domain/repositories/SessionRepository';
import { createErrorHandler } from './errorHandler';
import { authenticatedContext, createRequireAuth } from './requireAuth';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const now = new Date('2026-11-05T12:00:00.000Z');

const activeSession: Session = {
  id: SESSION_ID,
  guardianId: 7,
  createdAt: now,
  lastUsedAt: now,
  revokedAt: null,
  revokedReason: null,
};

function setup(options: {
  verify?: AccessTokenService['verify'];
  session?: Session | null;
}) {
  const verify = jest.fn(
    options.verify ??
      (() => Promise.resolve({ guardianId: 7, sessionId: SESSION_ID })),
  );
  const accessTokens: AccessTokenService = { issue: jest.fn(), verify };
  const findActive = jest.fn(() =>
    Promise.resolve(
      options.session === undefined ? activeSession : options.session,
    ),
  );
  const sessions: SessionRepository = {
    create: jest.fn(),
    findActive,
    findByRefreshHash: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
  };
  const app = express();
  app.get(
    '/protegido',
    createRequireAuth(accessTokens, sessions),
    (_request, response) => {
      response.json(authenticatedContext(response));
    },
  );
  app.use(createErrorHandler({ info: jest.fn(), error: jest.fn() }));
  return { app, verify, findActive };
}

const invalidToken = {
  erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token de acesso inválido.' },
};

describe('requireAuth', () => {
  it('libera com token válido e sessão ativa, expondo só guardianId e sessionId', async () => {
    const { app, verify, findActive } = setup({});

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ guardianId: 7, sessionId: SESSION_ID });
    expect(verify).toHaveBeenCalledWith('aaa.bbb.ccc');
    expect(findActive).toHaveBeenCalledWith(SESSION_ID, 7);
  });

  it.each([
    ['sem cabeçalho Authorization', undefined],
    ['com outro esquema', 'Basic dXN1YXJpbzpzZW5oYQ=='],
    ['com Bearer vazio', 'Bearer '],
    ['com dois tokens', 'Bearer aaa.bbb.ccc ddd.eee.fff'],
  ])('recusa %s com 401 TOKEN_INVALIDO', async (_caso, header) => {
    const { app, verify } = setup({});
    const call = request(app).get('/protegido');
    if (header !== undefined) {
      void call.set('Authorization', header);
    }

    const response = await call;

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
    expect(verify).not.toHaveBeenCalled();
  });

  it('recusa token com assinatura ou claims inválidos com 401 TOKEN_INVALIDO', async () => {
    const { app, findActive } = setup({
      verify: () => Promise.reject(new InvalidAccessTokenError()),
    });

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
    expect(findActive).not.toHaveBeenCalled();
  });

  it('recusa token vencido com 401 TOKEN_EXPIRADO', async () => {
    const { app } = setup({
      verify: () => Promise.reject(new ExpiredAccessTokenError()),
    });

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ erro: { codigo: 'TOKEN_EXPIRADO' } });
  });

  it('recusa token de sessão revogada, inexistente ou de outro responsável', async () => {
    const { app } = setup({ session: null });

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer aaa.bbb.ccc');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });
});
