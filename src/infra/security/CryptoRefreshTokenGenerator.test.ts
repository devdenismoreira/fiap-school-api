import { createHash } from 'node:crypto';
import { CryptoRefreshTokenGenerator } from './CryptoRefreshTokenGenerator';

describe('CryptoRefreshTokenGenerator', () => {
  const generator = new CryptoRefreshTokenGenerator();

  it('gera 32 bytes aleatórios em base64url, opacos (não JWT)', () => {
    const { token } = generator.generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('devolve o SHA-256 em hexadecimal, que é o que vai para o banco', () => {
    const { token, hash } = generator.generate();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(generator.hash(token)).toBe(hash);
  });

  it('não repete tokens', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generator.generate().token),
    );

    expect(tokens.size).toBe(100);
  });
});
