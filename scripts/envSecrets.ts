import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';

export type GeneratedSecrets = Readonly<Record<string, string>>;

export type MergeResult = Readonly<{
  content: string;
  added: readonly string[];
  kept: readonly string[];
}>;

function quotedPem(pem: string): string {
  return `"${pem.trim().replace(/\n/g, '\\n')}"`;
}

export function generateSecrets(): GeneratedSecrets {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    JWT_PRIVATE_KEY: quotedPem(privateKey),
    JWT_PUBLIC_KEY: quotedPem(publicKey),
    CPF_HMAC_SECRET: randomBytes(32).toString('base64url'),
  };
}

function lineFor(name: string): RegExp {
  return new RegExp(`^${name}=.*$`, 'm');
}

export function mergeSecrets(
  content: string,
  secrets: GeneratedSecrets,
): MergeResult {
  const existing = parseEnv(content) as Record<string, string | undefined>;
  const added: string[] = [];
  const kept: string[] = [];
  let merged = content;
  for (const [name, value] of Object.entries(secrets)) {
    if (existing[name]) {
      kept.push(name);
      continue;
    }
    const line = `${name}=${value}`;
    if (lineFor(name).test(merged)) {
      merged = merged.replace(lineFor(name), line);
    } else {
      const separator = merged === '' || merged.endsWith('\n') ? '' : '\n';
      merged = `${merged}${separator}${line}\n`;
    }
    added.push(name);
  }
  return { content: merged, added, kept };
}
