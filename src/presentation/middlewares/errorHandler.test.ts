import express from 'express';
import request from 'supertest';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  StudentNotFoundError,
} from '@/domain/errors/DomainErrors';
import { createErrorHandler } from './errorHandler';
import { InvalidRequestError } from './validate';

function appThrowing(error: unknown) {
  const logger = { info: jest.fn(), error: jest.fn() };
  const app = express();
  app.get('/falha', () => {
    throw error;
  });
  app.use(createErrorHandler(logger));
  return { app, logger };
}

const internalError = {
  erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.' },
};

describe('errorHandler', () => {
  it('transforma erro inesperado em 500 genérico, sem detalhes nem stack', async () => {
    const error = new Error('detalhe interno do banco');
    const { app } = appThrowing(error);

    const response = await request(app).get('/falha');

    expect(response.status).toBe(500);
    expect(response.body).toEqual(internalError);
    expect(response.text).not.toContain('detalhe interno');
    expect(response.text).not.toContain('at ');
  });

  it('registra o erro inesperado só no log', async () => {
    const error = new Error('detalhe interno do banco');
    const { app, logger } = appThrowing(error);

    await request(app).get('/falha');

    expect(logger.error).toHaveBeenCalledWith(
      { err: error },
      'Erro inesperado',
    );
  });

  it('transforma erro de corpo da requisição (4xx exposto) em 400 DADOS_INVALIDOS', async () => {
    const { app, logger } = appThrowing(
      Object.assign(new Error('entity.parse.failed'), {
        status: 400,
        expose: true,
      }),
    );

    const response = await request(app).get('/falha');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.' },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('não trata como erro do cliente um 4xx que não foi marcado como exposto', async () => {
    const { app } = appThrowing(
      Object.assign(new Error('falha'), { status: 401, expose: false }),
    );

    const response = await request(app).get('/falha');

    expect(response.status).toBe(500);
    expect(response.body).toEqual(internalError);
  });

  it('responde 500 genérico quando o valor lançado não é um Error', async () => {
    const { app } = appThrowing('texto lançado');

    const response = await request(app).get('/falha');

    expect(response.status).toBe(500);
    expect(response.body).toEqual(internalError);
  });
});

describe('errorHandler com erros conhecidos', () => {
  it.each([
    [new InvalidRequestError(), 400, 'DADOS_INVALIDOS', 'Dados inválidos.'],
    [
      new InvalidCredentialsError(),
      401,
      'CREDENCIAIS_INVALIDAS',
      'Usuário ou senha inválida.',
    ],
    [
      new InvalidAccessTokenError(),
      401,
      'TOKEN_INVALIDO',
      'Token de acesso inválido.',
    ],
    [
      new ExpiredAccessTokenError(),
      401,
      'TOKEN_EXPIRADO',
      'Token de acesso expirado.',
    ],
    [
      new InvalidRefreshTokenError(),
      401,
      'REFRESH_INVALIDO',
      'Sessão inválida ou expirada.',
    ],
    [
      new StudentNotFoundError(),
      404,
      'ALUNO_NAO_ENCONTRADO',
      'Aluno não encontrado.',
    ],
  ])(
    '%s responde %i %s, sem registrar como erro inesperado',
    async (error, status, codigo, mensagem) => {
      const { app, logger } = appThrowing(error);

      const response = await request(app).get('/falha');

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ erro: { codigo, mensagem } });
      expect(logger.error).not.toHaveBeenCalled();
    },
  );
});
