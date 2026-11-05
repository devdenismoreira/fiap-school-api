import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { loadDatabaseEnv, loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';
import {
  loadSourceForTests,
  withoutCredentials,
} from '../support/seedSourceForTests';

const source = loadSourceForTests();
const [first, second] = source;
const UNKNOWN_VALID_CPF = '86686328685';
const INVALID_CHECK_DIGIT_CPF = '86686328695';
const prisma = createPrismaClient(loadDatabaseEnv(process.env).database, {
  info: () => undefined,
  error: () => undefined,
});

type LoginBody = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  responsavel: unknown;
};

async function startApi(logDestination?: DestinationStream) {
  const env = loadEnv(process.env);
  return createDependencies(
    { ...env, logLevel: logDestination ? 'info' : env.logLevel },
    logDestination ? { logDestination } : {},
  );
}

function login(api: Dependencies, body: unknown) {
  return request(api.app)
    .post('/v1/auth/login')
    .send(body as object);
}

afterAll(() => prisma.$disconnect());

describe('POST /v1/auth/login com credenciais válidas', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it.each(source.map(guardian => guardian.id))(
    'o responsável %i recebe 200 com tokens e o responsável igual ao JSON, sem credenciais',
    async id => {
      const guardian = source.find(item => item.id === id)!;

      const response = await login(api, {
        cpf: guardian.cpf,
        senha: guardian.senha,
      });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = response.body as LoginBody;
      expect(body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshExpiresIn: 2_592_000,
      });
      expect(body.responsavel).toStrictEqual(withoutCredentials(guardian));
      for (const secret of [guardian.cpf, guardian.email, guardian.senha]) {
        expect(response.text).not.toContain(secret);
      }
    },
  );

  it('o access token traz sub, sid, iss, aud, exp e jti, sem dados pessoais', async () => {
    const response = await login(api, { cpf: first!.cpf, senha: first!.senha });
    const { accessToken } = response.body as LoginBody;

    const payload = decodeJwt(accessToken);
    expect(Object.keys(payload).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'jti',
      'sid',
      'sub',
    ]);
    expect(payload).toMatchObject({
      sub: String(first!.id),
      iss: 'fiap-school-api',
      aud: 'fiap-school-mobile',
    });
    const serialized = JSON.stringify(payload);
    for (const secret of [first!.cpf, first!.email, first!.primeiroNome]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('cada login cria uma sessão, com o refresh gravado só como hash', async () => {
    const one = (await login(api, { cpf: first!.cpf, senha: first!.senha }))
      .body as LoginBody;
    const two = (await login(api, { cpf: first!.cpf, senha: first!.senha }))
      .body as LoginBody;
    const sidOne = decodeJwt(one.accessToken).sid as string;
    const sidTwo = decodeJwt(two.accessToken).sid as string;

    expect(sidOne).not.toBe(sidTwo);
    const stored = await prisma.refreshToken.findMany({
      where: { sessionId: sidOne },
      select: { tokenHash: true, session: { select: { guardianId: true } } },
    });
    expect(stored).toEqual([
      {
        tokenHash: createHash('sha256').update(one.refreshToken).digest('hex'),
        session: { guardianId: first!.id },
      },
    ]);
    await expect(
      prisma.refreshToken.count({ where: { tokenHash: one.refreshToken } }),
    ).resolves.toBe(0);
  });
});

describe('POST /v1/auth/login com credenciais inválidas', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('CPF inexistente, dígito verificador inválido e senha errada recebem a mesma resposta 401', async () => {
    const attempts = [
      { cpf: UNKNOWN_VALID_CPF, senha: first!.senha },
      { cpf: INVALID_CHECK_DIGIT_CPF, senha: first!.senha },
      { cpf: first!.cpf, senha: `${first!.senha}-errada` },
    ];

    const responses = [];
    for (const attempt of attempts) {
      responses.push(await login(api, attempt));
    }

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({
        erro: {
          codigo: 'CREDENCIAIS_INVALIDAS',
          mensagem: 'Usuário ou senha inválida.',
        },
      });
    }
  });
});

describe('POST /v1/auth/login com corpo inválido', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it.each([
    ['senha com 73 bytes', () => ({ cpf: first!.cpf, senha: 'a'.repeat(73) })],
    ['CPF com máscara', () => ({ cpf: '866.863.286-85', senha: 'x' })],
    ['sem senha', () => ({ cpf: first!.cpf })],
    ['corpo vazio', () => ({})],
  ])('%s recebe 400 DADOS_INVALIDOS', async (_caso, body) => {
    const response = await login(api, body());

    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.' },
    });
  });

  it('JSON malformado recebe 400 DADOS_INVALIDOS', async () => {
    const response = await request(api.app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"cpf":');

    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('limite de tentativas por CPF', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('a 6ª falha seguida do mesmo CPF recebe 429 com Retry-After, e o CPF fica bloqueado', async () => {
    const wrong = { cpf: second!.cpf, senha: `${second!.senha}-errada` };
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await login(api, wrong).expect(401);
    }

    const blocked = await login(api, wrong);
    const evenWithRightPassword = await login(api, {
      cpf: second!.cpf,
      senha: second!.senha,
    });

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      erro: { codigo: 'MUITAS_TENTATIVAS' },
    });
    expect(evenWithRightPassword.status).toBe(429);
  });

  it('o bloqueio de um CPF não afeta outro', async () => {
    await login(api, {
      cpf: first!.cpf,
      senha: `${first!.senha}-errada`,
    }).expect(401);
  });
});

describe('limite de tentativas por IP', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('a 21ª requisição de login do mesmo IP no minuto recebe 429', async () => {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await login(api, {}).expect(400);
    }

    const blocked = await login(api, {});

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('logs do login', () => {
  it('registram sucesso e falha só com o HMAC do CPF, sem CPF, senha ou tokens', async () => {
    const lines: string[] = [];
    const api = await startApi({
      write: (line: string) => {
        lines.push(line);
      },
    });

    try {
      const success = await login(api, {
        cpf: first!.cpf,
        senha: first!.senha,
      });
      await login(api, { cpf: first!.cpf, senha: `${first!.senha}-errada` });
      const { accessToken, refreshToken } = success.body as LoginBody;

      const output = lines.join('');
      expect(output).toContain('"evento":"login_sucesso"');
      expect(output).toContain('"evento":"login_falha"');
      expect(output).toMatch(/"cpfHmac":"[0-9a-f]{64}"/);
      const forbidden = [
        first!.cpf,
        first!.senha,
        first!.email,
        accessToken,
        refreshToken,
      ];
      const leaked = forbidden.filter(value => output.includes(value));
      expect(leaked).toHaveLength(0);
    } finally {
      await api.close();
    }
  });
});
