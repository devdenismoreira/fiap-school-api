import express from 'express';
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';
import request from 'supertest';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaSessionRepository } from '@/infra/database/repositories/PrismaSessionRepository';
import { CryptoRefreshTokenGenerator } from '@/infra/security/CryptoRefreshTokenGenerator';
import { JoseAccessTokenService } from '@/infra/security/JoseAccessTokenService';
import { SystemClock } from '@/infra/security/SystemClock';
import { createAuthenticate } from '@/domain/usecases/authenticate';
import { loadDatabaseEnv } from '@/main/config/env';
import { createErrorHandler } from '@/presentation/middlewares/errorHandler';
import {
  authenticatedContext,
  createRequireAuth,
} from '@/presentation/middlewares/requireAuth';
import { loadSourceForTests } from '../support/seedSourceForTests';

const logger = { info: jest.fn(), error: jest.fn() };
const prisma = createPrismaClient(
  loadDatabaseEnv(process.env).database,
  logger,
);
const sessions = new PrismaSessionRepository(prisma);
const generator = new CryptoRefreshTokenGenerator();
const [guardianId] = loadSourceForTests().map(guardian => guardian.id);
let accessTokens: JoseAccessTokenService;
let app: express.Express;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  accessTokens = await JoseAccessTokenService.create(
    {
      privateKeyPem: await exportPKCS8(privateKey),
      publicKeyPem: await exportSPKI(publicKey),
      issuer: 'fiap-school-api',
      audience: 'fiap-school-mobile',
      ttlSeconds: 900,
    },
    new SystemClock(),
  );
  app = express();
  app.get(
    '/protegido',
    createRequireAuth(
      createAuthenticate({ accessTokens, sessions, clock: new SystemClock() }),
    ),
    (_request, response) => {
      response.json(authenticatedContext(response));
    },
  );
  app.use(createErrorHandler(logger));
});

afterAll(() => prisma.$disconnect());

async function tokenForNewSession() {
  const session = await sessions.create(guardianId!, {
    hash: generator.generate().hash,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const { token } = await accessTokens.issue({
    guardianId: guardianId!,
    sessionId: session.id,
  });
  return { session, token };
}

describe('requireAuth com token real e sessão no banco', () => {
  it('libera o token de uma sessão ativa', async () => {
    const { session, token } = await tokenForNewSession();

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ guardianId, sessionId: session.id });
  });

  it('recusa na hora o token de uma sessão revogada', async () => {
    const { session, token } = await tokenForNewSession();
    await sessions.revoke(session.id, 'logout', new Date());

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token de acesso inválido.' },
    });
  });

  it('recusa token com sid de sessão inexistente', async () => {
    const { token } = await accessTokens.issue({
      guardianId: guardianId!,
      sessionId: '00000000-0000-4000-8000-000000000000',
    });

    const response = await request(app)
      .get('/protegido')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });
});
