import { createPrivateKey, createPublicKey } from 'node:crypto';
import { parseEnv } from 'node:util';
import { generateSecrets, mergeSecrets } from './envSecrets';

const SECRETS = {
  JWT_PRIVATE_KEY:
    '"-----BEGIN PRIVATE KEY-----\\nAAA\\n-----END PRIVATE KEY-----"',
  JWT_PUBLIC_KEY:
    '"-----BEGIN PUBLIC KEY-----\\nBBB\\n-----END PUBLIC KEY-----"',
  CPF_HMAC_SECRET: 'segredo-gerado',
};

describe('generateSecrets', () => {
  it('gera um par ES256 válido e um segredo de 32 bytes, em linhas únicas', () => {
    const secrets = generateSecrets();
    const env = parseEnv(
      Object.entries(secrets)
        .map(([name, value]) => `${name}=${value}`)
        .join('\n'),
    ) as Record<string, string>;

    const privateKey = createPrivateKey(env.JWT_PRIVATE_KEY ?? '');
    const publicKey = createPublicKey(env.JWT_PUBLIC_KEY ?? '');
    expect(privateKey.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
    expect(publicKey.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
    expect(Buffer.from(env.CPF_HMAC_SECRET ?? '', 'base64url')).toHaveLength(
      32,
    );
    for (const value of Object.values(secrets)) {
      expect(value).not.toContain('\n');
    }
  });

  it('gera valores diferentes a cada chamada', () => {
    expect(generateSecrets().CPF_HMAC_SECRET).not.toBe(
      generateSecrets().CPF_HMAC_SECRET,
    );
  });
});

describe('mergeSecrets', () => {
  it('acrescenta as variáveis ausentes e preserva o restante do arquivo', () => {
    const result = mergeSecrets('NODE_ENV=development\nPORT=3000', SECRETS);

    expect(result.added).toEqual([
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY',
      'CPF_HMAC_SECRET',
    ]);
    expect(result.kept).toEqual([]);
    const env = parseEnv(result.content);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: '3000',
      CPF_HMAC_SECRET: 'segredo-gerado',
      JWT_PRIVATE_KEY:
        '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----',
    });
  });

  it('preenche a linha que existe vazia, sem duplicá-la', () => {
    const result = mergeSecrets(
      'JWT_PRIVATE_KEY=\nJWT_PUBLIC_KEY=\nCPF_HMAC_SECRET=\n',
      SECRETS,
    );

    expect(result.content.match(/^JWT_PRIVATE_KEY=/gm)).toHaveLength(1);
    expect(parseEnv(result.content)).toMatchObject({
      CPF_HMAC_SECRET: 'segredo-gerado',
    });
  });

  it('nunca sobrescreve um valor já definido', () => {
    const result = mergeSecrets('CPF_HMAC_SECRET=segredo-antigo\n', SECRETS);

    expect(result.kept).toEqual(['CPF_HMAC_SECRET']);
    expect(parseEnv(result.content)).toMatchObject({
      CPF_HMAC_SECRET: 'segredo-antigo',
    });
  });

  it('funciona com arquivo vazio', () => {
    const result = mergeSecrets('', SECRETS);

    expect(result.content.startsWith('JWT_PRIVATE_KEY=')).toBe(true);
    expect(result.content.endsWith('\n')).toBe(true);
  });
});
