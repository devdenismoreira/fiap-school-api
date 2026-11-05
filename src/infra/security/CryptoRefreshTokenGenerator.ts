import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedRefreshToken,
  RefreshTokenGenerator,
} from '@/domain/ports/RefreshTokenGenerator';

const TOKEN_BYTES = 32;

export class CryptoRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): GeneratedRefreshToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
