import express from 'express';
import request from 'supertest';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import type { GetCurrentGuardian } from '@/domain/usecases/getCurrentGuardian';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import { MeController } from './MeController';

function setup(getCurrentGuardian: GetCurrentGuardian, guardianId?: number) {
  const controller = new MeController(getCurrentGuardian);
  const app = express();
  app.get(
    '/v1/me',
    (_request, response, next) => {
      if (guardianId !== undefined) {
        response.locals.auth = { guardianId, sessionId: 'sessao' };
      }
      next();
    },
    controller.show,
  );
  app.use(createErrorHandler({ info: jest.fn(), error: jest.fn() }));
  return app;
}

describe('MeController', () => {
  it('busca o responsável pelo id do token e responde com a guardianView', async () => {
    const getCurrentGuardian = jest.fn<
      ReturnType<GetCurrentGuardian>,
      [number]
    >(() =>
      Promise.resolve({
        id: 7,
        firstName: 'Ana',
        lastName: 'Exemplo',
        students: [],
      }),
    );

    const response = await request(setup(getCurrentGuardian, 7)).get(
      '/v1/me?id=99',
    );

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: 7,
      primeiroNome: 'Ana',
      sobrenome: 'Exemplo',
      alunos: [],
    });
    expect(getCurrentGuardian).toHaveBeenCalledWith(7);
  });

  it('sem contexto autenticado, responde 401 TOKEN_INVALIDO', async () => {
    const getCurrentGuardian = jest.fn<
      ReturnType<GetCurrentGuardian>,
      [number]
    >();

    const response = await request(setup(getCurrentGuardian)).get('/v1/me');

    expect(response.status).toBe(401);
    expect(getCurrentGuardian).not.toHaveBeenCalled();
  });

  it('responsável que não existe mais responde 401 TOKEN_INVALIDO', async () => {
    const response = await request(
      setup(() => Promise.reject(new InvalidAccessTokenError()), 7),
    ).get('/v1/me');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ erro: { codigo: 'TOKEN_INVALIDO' } });
  });
});
