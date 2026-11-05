import express, { type RequestHandler } from 'express';
import { MemoryStore } from 'express-rate-limit';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import {
  cpfRateLimitKey,
  createCpfRateLimit,
  createIpRateLimit,
} from './rateLimit';

const SECRET = 'segredo-ficticio-de-teste-com-32-caracteres';
const CPF = '86686328685';
const OTHER_CPF = '06127842581';

class RecordingStore extends MemoryStore {
  readonly keys = new Set<string>();

  override async increment(key: string) {
    this.keys.add(key);
    return super.increment(key);
  }
}

function fakeLogger() {
  return { info: jest.fn(), error: jest.fn() };
}

function appWith(limiter: RequestHandler, status: () => number) {
  const app = express();
  app.use(express.json());
  app.all('/rota', limiter, (_request, response) => {
    response.sendStatus(status());
  });
  return app;
}

describe('createIpRateLimit', () => {
  it('responde 429 MUITAS_TENTATIVAS com Retry-After acima do limite', async () => {
    const logger = fakeLogger();
    const app = appWith(
      createIpRateLimit({ windowMs: 60_000, limit: 2 }, logger),
      () => 200,
    );

    await request(app).get('/rota').expect(200);
    await request(app).get('/rota').expect(200);
    const blocked = await request(app).get('/rota');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      erro: {
        codigo: 'MUITAS_TENTATIVAS',
        mensagem: 'Muitas tentativas. Tente novamente mais tarde.',
      },
    });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(logger.info).toHaveBeenCalledWith(
      { evento: 'muitas_tentativas', limite: 'ip' },
      'Limite de tentativas atingido',
    );
  });

  it('não conta o preflight OPTIONS', async () => {
    const app = appWith(
      createIpRateLimit({ windowMs: 60_000, limit: 1 }, fakeLogger()),
      () => 204,
    );

    await request(app).options('/rota').expect(204);
    await request(app).options('/rota').expect(204);
    await request(app).get('/rota').expect(204);
  });
});

describe('cpfRateLimitKey', () => {
  it('é o HMAC-SHA256 do CPF em hexadecimal, sem o CPF em claro', () => {
    const key = cpfRateLimitKey(CPF, SECRET);

    expect(key).toBe(createHmac('sha256', SECRET).update(CPF).digest('hex'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(CPF);
  });

  it('muda com o segredo', () => {
    expect(cpfRateLimitKey(CPF, SECRET)).not.toBe(
      cpfRateLimitKey(CPF, `${SECRET}-outro`),
    );
  });
});

describe('createCpfRateLimit', () => {
  function loginApp(store: RecordingStore, statusFor: (cpf: string) => number) {
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createCpfRateLimit(
        { windowMs: 15 * 60_000, limit: 2, store },
        SECRET,
        fakeLogger(),
      ),
      (incoming, response) => {
        const { cpf } = incoming.body as { cpf: string };
        response.sendStatus(statusFor(cpf));
      },
    );
    return app;
  }

  it('bloqueia o CPF depois do limite de falhas, com Retry-After', async () => {
    const app = loginApp(new RecordingStore(), () => 401);

    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    const blocked = await request(app).post('/login').send({ cpf: CPF });

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('conta cada CPF separadamente', async () => {
    const app = loginApp(new RecordingStore(), () => 401);

    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    await request(app).post('/login').send({ cpf: CPF }).expect(401);

    await request(app).post('/login').send({ cpf: OTHER_CPF }).expect(401);
  });

  it('o sucesso zera as falhas daquele CPF', async () => {
    let status = 401;
    const app = loginApp(new RecordingStore(), () => status);

    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    status = 200;
    await request(app).post('/login').send({ cpf: CPF }).expect(200);
    status = 401;
    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    await request(app).post('/login').send({ cpf: CPF }).expect(401);
    await request(app).post('/login').send({ cpf: CPF }).expect(429);
  });

  it('guarda no contador só o HMAC, nunca o CPF em claro', async () => {
    const store = new RecordingStore();
    const app = loginApp(store, () => 401);

    await request(app).post('/login').send({ cpf: CPF });

    expect([...store.keys]).toEqual([cpfRateLimitKey(CPF, SECRET)]);
    expect([...store.keys].join()).not.toContain(CPF);
  });
});
