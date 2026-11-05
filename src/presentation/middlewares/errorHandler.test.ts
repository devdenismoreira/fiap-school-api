import express from 'express';
import request from 'supertest';
import { createErrorHandler } from './errorHandler';

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
