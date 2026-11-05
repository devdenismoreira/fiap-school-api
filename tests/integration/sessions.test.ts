import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import type { Clock } from '@/domain/ports/Clock';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { loadDatabaseEnv, loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';
import { loadSourceForTests } from '../support/seedSourceForTests';

const env = loadEnv(process.env);
const [first] = loadSourceForTests();
const prisma = createPrismaClient(loadDatabaseEnv(process.env).database, {
  info: () => undefined,
  error: () => undefined,
});

type Tokens = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
};

class FakeClock implements Clock {
  private current = new Date();
  now(): Date {
    return this.current;
  }
  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

async function startApi(
  options: { clock?: Clock; logDestination?: DestinationStream } = {},
) {
  return createDependencies(
    { ...env, logLevel: options.logDestination ? 'info' : env.logLevel },
    options,
  );
}

async function login(api: Dependencies): Promise<Tokens> {
  const response = await request(api.app)
    .post('/v1/auth/login')
    .send({ cpf: first!.cpf, senha: first!.senha })
    .expect(200);
  return response.body as Tokens;
}

function refresh(api: Dependencies, refreshToken: string) {
  return request(api.app).post('/v1/auth/refresh').send({ refreshToken });
}

function logout(api: Dependencies, refreshToken: string) {
  return request(api.app).post('/v1/auth/logout').send({ refreshToken });
}

function me(api: Dependencies, accessToken: string) {
  return request(api.app)
    .get('/v1/me')
    .set('Authorization', `Bearer ${accessToken}`);
}

const invalidRefresh = {
  erro: {
    codigo: 'REFRESH_INVALIDO',
    mensagem: 'Sessão inválida ou expirada.',
  },
};

afterAll(() => prisma.$disconnect());

describe('POST /v1/auth/refresh', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('devolve um par novo, sem responsavel, na mesma sessão e com no-store', async () => {
    const session = await login(api);

    const response = await refresh(api, session.refreshToken);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const renewed = response.body as Tokens;
    expect(Object.keys(renewed).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'refreshExpiresIn',
      'refreshToken',
      'tokenType',
    ]);
    expect(renewed).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: env.auth.accessTokenTtlSeconds,
      refreshExpiresIn: env.auth.refreshTokenTtlSeconds,
    });
    expect(renewed.refreshToken).not.toBe(session.refreshToken);
    expect(decodeJwt(renewed.accessToken).sid).toBe(
      decodeJwt(session.accessToken).sid,
    );
    await me(api, renewed.accessToken).expect(200);
  });

  it('rotação: o refresh novo continua girando, e o antigo fica marcado como usado', async () => {
    const session = await login(api);
    const second = (await refresh(api, session.refreshToken).expect(200))
      .body as Tokens;

    await refresh(api, second.refreshToken).expect(200);

    const old = await prisma.refreshToken.findUnique({
      where: {
        tokenHash: createHash('sha256')
          .update(session.refreshToken)
          .digest('hex'),
      },
      select: { usedAt: true, replacedBy: true },
    });
    expect(old?.usedAt).not.toBeNull();
    expect(old?.replacedBy).not.toBeNull();
  });

  it('reuso: o refresh antigo recebe 401 e revoga a sessão, invalidando também o access e o refresh emitidos depois', async () => {
    const session = await login(api);
    const renewed = (await refresh(api, session.refreshToken).expect(200))
      .body as Tokens;

    const reused = await refresh(api, session.refreshToken);

    expect(reused.status).toBe(401);
    expect(reused.body).toEqual(invalidRefresh);
    expect((await refresh(api, renewed.refreshToken)).status).toBe(401);
    expect((await me(api, renewed.accessToken)).status).toBe(401);
    const revoked = await prisma.session.findUniqueOrThrow({
      where: { id: decodeJwt(session.accessToken).sid as string },
      select: { revokedReason: true },
    });
    expect(revoked.revokedReason).toBe('reuso');
  });

  it('refresh desconhecido recebe 401 REFRESH_INVALIDO', async () => {
    const response = await refresh(api, 'A'.repeat(43));

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidRefresh);
  });

  it('corpo inválido recebe 400 DADOS_INVALIDOS com no-store', async () => {
    const response = await request(api.app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'curto' });

    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /v1/auth/refresh com relógio controlado', () => {
  let api: Dependencies;
  let clock: FakeClock;
  beforeAll(async () => {
    clock = new FakeClock();
    api = await startApi({ clock });
  });
  afterAll(() => api.close());

  it('refresh vencido recebe 401 REFRESH_INVALIDO, sem revogar a sessão', async () => {
    const session = await login(api);
    clock.advance(env.auth.refreshTokenTtlSeconds + 1);

    const response = await refresh(api, session.refreshToken);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidRefresh);
    const stored = await prisma.session.findUniqueOrThrow({
      where: { id: decodeJwt(session.accessToken).sid as string },
      select: { revokedAt: true },
    });
    expect(stored.revokedAt).toBeNull();
  });

  it('logout funciona com o access token já vencido, porque não o exige', async () => {
    const session = await login(api);
    clock.advance(env.auth.accessTokenTtlSeconds + 31);
    const expired = await me(api, session.accessToken);
    expect(expired.body).toMatchObject({ erro: { codigo: 'TOKEN_EXPIRADO' } });

    await logout(api, session.refreshToken).expect(204);

    expect((await refresh(api, session.refreshToken)).status).toBe(401);
  });
});

describe('POST /v1/auth/logout', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('revoga a sessão na hora: o access dela recebe 401 no /me, e o refresh também', async () => {
    const session = await login(api);
    await me(api, session.accessToken).expect(200);

    const response = await logout(api, session.refreshToken);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['cache-control']).toBe('no-store');
    const after = await me(api, session.accessToken);
    expect(after.status).toBe(401);
    expect(after.body).toMatchObject({ erro: { codigo: 'TOKEN_INVALIDO' } });
    expect((await refresh(api, session.refreshToken)).status).toBe(401);
  });

  it('é idempotente: 204 na segunda chamada e para refresh desconhecido', async () => {
    const session = await login(api);

    await logout(api, session.refreshToken).expect(204);
    await logout(api, session.refreshToken).expect(204);
    await logout(api, 'B'.repeat(43)).expect(204);
  });

  it('sessões de aparelhos diferentes são independentes', async () => {
    const phone = await login(api);
    const tablet = await login(api);

    await logout(api, phone.refreshToken).expect(204);

    await me(api, tablet.accessToken).expect(200);
    await refresh(api, tablet.refreshToken).expect(200);
  });

  it('corpo inválido recebe 400 DADOS_INVALIDOS', async () => {
    await request(api.app).post('/v1/auth/logout').send({}).expect(400);
  });
});

describe('logs das sessões', () => {
  it('registram reuso e logout só com o sessao_id, sem tokens', async () => {
    const lines: string[] = [];
    const api = await startApi({
      logDestination: {
        write: (line: string) => {
          lines.push(line);
        },
      },
    });

    try {
      const reused = await login(api);
      const renewed = (await refresh(api, reused.refreshToken).expect(200))
        .body as Tokens;
      await refresh(api, reused.refreshToken).expect(401);
      const ended = await login(api);
      await logout(api, ended.refreshToken).expect(204);

      const output = lines.join('');
      expect(output).toContain('"evento":"refresh_reutilizado"');
      expect(output).toContain('"evento":"sessao_revogada"');
      expect(output).toContain(
        `"sessaoId":"${decodeJwt(reused.accessToken).sid as string}"`,
      );
      const tokens = [reused, renewed, ended].flatMap(item => [
        item.accessToken,
        item.refreshToken,
      ]);
      expect(tokens.filter(token => output.includes(token))).toHaveLength(0);
    } finally {
      await api.close();
    }
  });
});
