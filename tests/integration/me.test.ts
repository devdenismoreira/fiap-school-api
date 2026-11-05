import { decodeJwt, importPKCS8, SignJWT } from 'jose';
import request from 'supertest';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaSessionRepository } from '@/infra/database/repositories/PrismaSessionRepository';
import { loadDatabaseEnv, loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';
import {
  loadSourceForTests,
  withoutCredentials,
} from '../support/seedSourceForTests';

const env = loadEnv(process.env);
const source = loadSourceForTests();
const [first, second] = source;
const prisma = createPrismaClient(loadDatabaseEnv(process.env).database, {
  info: () => undefined,
  error: () => undefined,
});
const sessions = new PrismaSessionRepository(prisma);

class FakeClock {
  private current = new Date();
  now(): Date {
    return this.current;
  }
  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

type LoginBody = { accessToken: string; responsavel: unknown };

async function loginAs(api: Dependencies, guardian: (typeof source)[number]) {
  const response = await request(api.app)
    .post('/v1/auth/login')
    .send({ cpf: guardian.cpf, senha: guardian.senha })
    .expect(200);
  return response.body as LoginBody;
}

function me(api: Dependencies, authorization?: string) {
  const call = request(api.app).get('/v1/me');
  return authorization ? call.set('Authorization', authorization) : call;
}

const invalidToken = {
  erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token de acesso inválido.' },
};

afterAll(() => prisma.$disconnect());

describe('GET /v1/me com o token do login', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await createDependencies(env);
  });
  afterAll(() => api.close());

  it.each(source.map(guardian => guardian.id))(
    'o responsável %i recebe o mesmo responsável do login, igual ao JSON, com no-store',
    async id => {
      const guardian = source.find(item => item.id === id)!;
      const login = await loginAs(api, guardian);

      const response = await me(api, `Bearer ${login.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toStrictEqual(login.responsavel);
      expect(response.body).toStrictEqual(withoutCredentials(guardian));
    },
  );

  it('ignora id na query e não tem rota com id: só devolve o dono do token', async () => {
    const login = await loginAs(api, first!);

    const withQuery = await me(api, `Bearer ${login.accessToken}`).query({
      id: second!.id,
    });
    const withPath = await request(api.app)
      .get(`/v1/me/${second!.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`);

    expect(withQuery.body).toStrictEqual(withoutCredentials(first!));
    expect(withPath.status).toBe(404);
  });
});

describe('GET /v1/me recusa tokens inválidos com 401 TOKEN_INVALIDO', () => {
  let api: Dependencies;
  let validToken: string;
  beforeAll(async () => {
    api = await createDependencies(env);
    validToken = (await loginAs(api, first!)).accessToken;
  });
  afterAll(() => api.close());

  it('sem cabeçalho', async () => {
    const response = await me(api);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('com esquema Basic', async () => {
    const response = await me(api, 'Basic dXN1YXJpbzpzZW5oYQ==');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('com o sub trocado para outro responsável e a assinatura original', async () => {
    const [header, , signature] = validToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...decodeJwt(validToken), sub: String(second!.id) }),
    ).toString('base64url');

    const response = await me(api, `Bearer ${header}.${forged}.${signature}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('com alg none', async () => {
    const unsigned = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = validToken.split('.')[1];

    const response = await me(api, `Bearer ${unsigned}.${payload}.`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('com aud errado, mesmo assinado com a chave correta', async () => {
    const claims = decodeJwt(validToken);
    const token = await new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
      .setSubject(String(claims.sub))
      .setIssuer(env.auth.issuer)
      .setAudience('outro-app')
      .setIssuedAt()
      .setExpirationTime('10m')
      .setJti('3d7b0b1e-5a4f-4c2d-9e8f-1a2b3c4d5e6f')
      .sign(await importPKCS8(env.auth.privateKeyPem, 'ES256'));

    const response = await me(api, `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });
});

describe('GET /v1/me com sessão revogada', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await createDependencies(env);
  });
  afterAll(() => api.close());

  it.each(['logout', 'reuso'] as const)(
    'depois da revogação por %s, o mesmo access token recebe 401 na hora',
    async reason => {
      const { accessToken } = await loginAs(api, first!);
      await me(api, `Bearer ${accessToken}`).expect(200);

      await sessions.revoke(
        decodeJwt(accessToken).sid as string,
        reason,
        new Date(),
      );
      const response = await me(api, `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual(invalidToken);
    },
  );

  it('revogar a sessão de um aparelho não derruba a de outro', async () => {
    const phone = await loginAs(api, first!);
    const tablet = await loginAs(api, first!);

    await sessions.revoke(
      decodeJwt(phone.accessToken).sid as string,
      'logout',
      new Date(),
    );

    await me(api, `Bearer ${tablet.accessToken}`).expect(200);
  });
});

describe('GET /v1/me com relógio controlado', () => {
  let api: Dependencies;
  let clock: FakeClock;
  beforeEach(async () => {
    clock = new FakeClock();
    api = await createDependencies(env, { clock });
  });
  afterEach(() => api.close());

  it('token vencido recebe 401 TOKEN_EXPIRADO', async () => {
    const { accessToken } = await loginAs(api, first!);
    clock.advance(env.auth.accessTokenTtlSeconds + 31);

    const response = await me(api, `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      erro: { codigo: 'TOKEN_EXPIRADO', mensagem: 'Token de acesso expirado.' },
    });
  });

  it('atualiza ultimo_uso_em no máximo uma vez por minuto', async () => {
    const { accessToken } = await loginAs(api, first!);
    const sessionId = decodeJwt(accessToken).sid as string;
    const lastUsedAt = async () =>
      (
        await prisma.session.findUniqueOrThrow({
          where: { id: sessionId },
          select: { lastUsedAt: true },
        })
      ).lastUsedAt;

    clock.advance(90);
    await me(api, `Bearer ${accessToken}`).expect(200);
    const afterFirstUse = await lastUsedAt();
    clock.advance(10);
    await me(api, `Bearer ${accessToken}`).expect(200);

    expect(afterFirstUse.getTime()).toBe(clock.now().getTime() - 10_000);
    await expect(lastUsedAt()).resolves.toEqual(afterFirstUse);
  });
});
