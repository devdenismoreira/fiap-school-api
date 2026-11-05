import { randomUUID } from 'node:crypto';
import {
  errors,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
} from '@/domain/errors/DomainErrors';
import type {
  AccessTokenClaims,
  AccessTokenService,
  IssuedAccessToken,
} from '@/domain/ports/AccessTokenService';
import type { Clock } from '@/domain/ports/Clock';

const ALGORITHM = 'ES256';
const TOKEN_TYPE = 'JWT';
const CLOCK_TOLERANCE_SECONDS = 30;
const REQUIRED_CLAIMS = ['sub', 'sid', 'iss', 'aud', 'iat', 'exp', 'jti'];
const SUBJECT_PATTERN = /^[1-9]\d{0,9}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AccessTokenConfig = Readonly<{
  privateKeyPem: string;
  publicKeyPem: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
}>;

function toClaims(payload: JWTPayload): AccessTokenClaims {
  const { sub } = payload;
  const sid: unknown = payload.sid;
  if (
    typeof sub !== 'string' ||
    !SUBJECT_PATTERN.test(sub) ||
    typeof sid !== 'string' ||
    !UUID_PATTERN.test(sid)
  ) {
    throw new InvalidAccessTokenError();
  }
  return { guardianId: Number(sub), sessionId: sid };
}

export class JoseAccessTokenService implements AccessTokenService {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    private readonly config: AccessTokenConfig,
    private readonly clock: Clock,
  ) {}

  static async create(
    config: AccessTokenConfig,
    clock: Clock,
  ): Promise<JoseAccessTokenService> {
    const [privateKey, publicKey] = await Promise.all([
      importPKCS8(config.privateKeyPem, ALGORITHM),
      importSPKI(config.publicKeyPem, ALGORITHM),
    ]);
    const service = new JoseAccessTokenService(
      privateKey,
      publicKey,
      config,
      clock,
    );
    await service.assertKeyPair();
    return service;
  }

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const token = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: ALGORITHM, typ: TOKEN_TYPE })
      .setSubject(String(claims.guardianId))
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.config.ttlSeconds)
      .setJti(randomUUID())
      .sign(this.privateKey);
    return { token, expiresInSeconds: this.config.ttlSeconds };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ALGORITHM],
        typ: TOKEN_TYPE,
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: this.clock.now(),
        requiredClaims: REQUIRED_CLAIMS,
      }));
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new ExpiredAccessTokenError();
      }
      throw new InvalidAccessTokenError();
    }
    return toClaims(payload);
  }

  private async assertKeyPair(): Promise<void> {
    const probe = { guardianId: 1, sessionId: randomUUID() };
    try {
      await this.verify((await this.issue(probe)).token);
    } catch {
      throw new Error(
        'JWT_PRIVATE_KEY e JWT_PUBLIC_KEY não formam um par ES256 válido.',
      );
    }
  }
}
