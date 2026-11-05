import {
  decodeJwt,
  decodeProtectedHeader,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  SignJWT,
} from 'jose';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '@/domain/errors/DomainErrors';
import {
  JoseAccessTokenService,
  type AccessTokenConfig,
} from './JoseAccessTokenService';

const SESSION_ID = '0b4f2c4e-9d7a-4f5e-8a61-2f3c4d5e6f70';
const TTL_SECONDS = 900;

class FakeClock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

async function pemPair() {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  return {
    privateKey,
    privateKeyPem: await exportPKCS8(privateKey),
    publicKeyPem: await exportSPKI(publicKey),
  };
}

describe('JoseAccessTokenService', () => {
  let keys: Awaited<ReturnType<typeof pemPair>>;
  let config: AccessTokenConfig;
  let clock: FakeClock;
  let service: JoseAccessTokenService;

  beforeAll(async () => {
    keys = await pemPair();
    config = {
      privateKeyPem: keys.privateKeyPem,
      publicKeyPem: keys.publicKeyPem,
      issuer: 'fiap-school-api',
      audience: 'fiap-school-mobile',
      ttlSeconds: TTL_SECONDS,
    };
  });

  beforeEach(async () => {
    clock = new FakeClock(new Date('2026-11-05T12:00:00.000Z'));
    service = await JoseAccessTokenService.create(config, clock);
  });

  function signCustom(claims: Record<string, unknown>, alg = 'ES256') {
    const issuedAt = Math.floor(clock.now().getTime() / 1000);
    return new SignJWT({ sid: SESSION_ID, ...claims })
      .setProtectedHeader({ alg, typ: 'JWT' })
      .setSubject('1')
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + TTL_SECONDS)
      .setJti('3d7b0b1e-5a4f-4c2d-9e8f-1a2b3c4d5e6f');
  }

  it('emite ES256 com sub, sid, iss, aud, iat, exp e jti, sem dados pessoais', async () => {
    const { token, expiresInSeconds } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });

    expect(expiresInSeconds).toBe(TTL_SECONDS);
    expect(decodeProtectedHeader(token)).toEqual({ alg: 'ES256', typ: 'JWT' });
    const payload = decodeJwt(token);
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
      sub: '42',
      sid: SESSION_ID,
      iss: 'fiap-school-api',
      aud: 'fiap-school-mobile',
    });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(TTL_SECONDS);
  });

  it('verifica o próprio token e devolve guardianId e sessionId', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });

    await expect(service.verify(token)).resolves.toEqual({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
  });

  it('recusa assinatura alterada', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
    const [header, payload, signature = ''] = token.split('.');
    const tampered = `${header}.${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;

    await expect(service.verify(tampered)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa payload alterado com a assinatura original', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...decodeJwt(token), sub: '1' }),
    ).toString('base64url');

    await expect(
      service.verify(`${header}.${forgedPayload}.${signature}`),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('recusa alg none', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
    const unsignedHeader = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = token.split('.')[1];

    await expect(
      service.verify(`${unsignedHeader}.${payload}.`),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('recusa HS256, mesmo assinado com a chave pública como segredo', async () => {
    const token = await signCustom({}, 'HS256').sign(
      new TextEncoder().encode(keys.publicKeyPem),
    );

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa token assinado por outra chave ES256', async () => {
    const other = await pemPair();
    const token = await signCustom({}).sign(other.privateKey);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa iss errado', async () => {
    const token = await signCustom({})
      .setIssuer('outra-api')
      .sign(keys.privateKey);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa aud errado', async () => {
    const token = await signCustom({})
      .setAudience('outro-app')
      .sign(keys.privateKey);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('o token de controle, com iss e aud corretos, é aceito', async () => {
    const token = await signCustom({}).sign(keys.privateKey);

    await expect(service.verify(token)).resolves.toEqual({
      guardianId: 1,
      sessionId: SESSION_ID,
    });
  });

  it.each([
    ['sid ausente', { sid: undefined }],
    ['sid que não é UUID', { sid: 'sessao-1' }],
  ])('recusa %s', async (_caso, override) => {
    const token = await signCustom(override).sign(keys.privateKey);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa sub que não é id numérico', async () => {
    const token = await signCustom({})
      .setSubject('responsavel-1')
      .sign(keys.privateKey);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('aceita até 30 s de diferença de relógio depois do vencimento', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
    clock.advance(TTL_SECONDS + 29);

    await expect(service.verify(token)).resolves.toEqual({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
  });

  it('recusa token vencido com ExpiredAccessTokenError', async () => {
    const { token } = await service.issue({
      guardianId: 42,
      sessionId: SESSION_ID,
    });
    clock.advance(TTL_SECONDS + 31);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      ExpiredAccessTokenError,
    );
  });

  it('não sobe com chaves que não formam um par', async () => {
    const other = await pemPair();

    await expect(
      JoseAccessTokenService.create(
        { ...config, publicKeyPem: other.publicKeyPem },
        clock,
      ),
    ).rejects.toThrow('não formam um par ES256 válido');
  });
});
