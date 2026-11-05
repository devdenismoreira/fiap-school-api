import express from 'express';
import request from 'supertest';
import { InvalidCredentialsError } from '@/domain/errors/DomainErrors';
import type { Login } from '@/domain/usecases/login';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import { LoginController } from './LoginController';

const CPF = '86686328685';
const SENHA = 'senha-ficticia';

function setup(login: Login) {
  const logger = { info: jest.fn(), error: jest.fn() };
  const fingerprint = jest.fn(() => 'hmac-do-cpf');
  const controller = new LoginController(login, logger, fingerprint);
  const app = express();
  app.use(express.json());
  app.post('/login', controller.handle);
  app.use(createErrorHandler(logger));
  return { app, logger, fingerprint };
}

describe('LoginController', () => {
  it('responde 200 com tokens e responsável e registra o sucesso só com o HMAC do CPF', async () => {
    const login = jest.fn<ReturnType<Login>, Parameters<Login>>(() =>
      Promise.resolve({
        guardian: {
          id: 7,
          firstName: 'Ana',
          lastName: 'Exemplo',
          students: [],
        },
        tokens: {
          accessToken: 'access-token',
          accessTokenExpiresIn: 900,
          refreshToken: 'refresh-opaco',
          refreshTokenExpiresIn: 2_592_000,
        },
      }),
    );
    const { app, logger, fingerprint } = setup(login);

    const response = await request(app)
      .post('/login')
      .send({ cpf: CPF, senha: SENHA });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      responsavel: { id: 7 },
    });
    expect(login).toHaveBeenCalledWith({ cpf: CPF, password: SENHA });
    expect(fingerprint).toHaveBeenCalledWith(CPF);
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'login_sucesso', cpfHmac: 'hmac-do-cpf' },
      'Login realizado',
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(CPF);
  });

  it('em credenciais inválidas, registra a falha só com o HMAC e responde 401 genérico', async () => {
    const { app, logger } = setup(() =>
      Promise.reject(new InvalidCredentialsError()),
    );

    const response = await request(app)
      .post('/login')
      .send({ cpf: CPF, senha: SENHA });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      erro: {
        codigo: 'CREDENCIAIS_INVALIDAS',
        mensagem: 'Usuário ou senha inválida.',
      },
    });
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'login_falha', cpfHmac: 'hmac-do-cpf' },
      'Falha de login',
    );
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain(CPF);
    expect(logged).not.toContain(SENHA);
  });
});
