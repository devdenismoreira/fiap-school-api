import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createErrorHandler } from './errorHandler';
import { noStore } from './noStore';
import { validate } from './validate';

const invalidData = {
  erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.' },
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.post(
    '/corpo',
    validate({ body: z.object({ cpf: z.string().regex(/^\d{11}$/) }) }),
    (incoming, response) => {
      response.json({ recebido: incoming.body as unknown });
    },
  );
  instance.get(
    '/alunos/:rm',
    validate({ params: z.object({ rm: z.coerce.number().int().positive() }) }),
    noStore,
    (_incoming, response) => {
      response.json({ params: response.locals.params });
    },
  );
  instance.use(createErrorHandler({ info: jest.fn(), error: jest.fn() }));
  return instance;
}

describe('validate', () => {
  it('troca o corpo pelo resultado validado, sem chaves desconhecidas', async () => {
    const response = await request(app())
      .post('/corpo')
      .send({ cpf: '86686328685', extra: 'ignorado' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ recebido: { cpf: '86686328685' } });
  });

  it.each([
    ['corpo com formato errado', { cpf: '866.863.286-85' }],
    ['corpo sem o campo', {}],
  ])('recusa %s com 400 sem detalhes de validação', async (_caso, body) => {
    const response = await request(app()).post('/corpo').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidData);
  });

  it('recusa requisição sem corpo JSON', async () => {
    const response = await request(app())
      .post('/corpo')
      .set('Content-Type', 'text/plain')
      .send('cpf=86686328685');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidData);
  });

  it('valida os parâmetros e guarda o resultado convertido', async () => {
    const response = await request(app()).get('/alunos/12345');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ params: { rm: 12345 } });
  });

  it('recusa parâmetro inválido com 400', async () => {
    const response = await request(app()).get('/alunos/abc');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidData);
  });
});

describe('noStore', () => {
  it('envia Cache-Control: no-store', async () => {
    const response = await request(app()).get('/alunos/12345');

    expect(response.headers['cache-control']).toBe('no-store');
  });
});
