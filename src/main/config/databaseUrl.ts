export type SslMode = 'require' | 'verify-ca' | 'verify-full';

export const ENCRYPTED_SSL_MODES: readonly SslMode[] = [
  'require',
  'verify-ca',
  'verify-full',
];
export const VERIFIED_SSL_MODES: readonly SslMode[] = ['verify-full'];

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;
const PROTOCOLS = new Set(['postgresql:', 'postgres:']);

export type DatabaseUrlCheck =
  { valid: true; schema: string } | { valid: false; problem: string };

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function listModes(modes: readonly SslMode[]): string {
  if (modes.length === 1) {
    return `sslmode=${modes.join('')}`;
  }
  return `sslmode=${modes.slice(0, -1).join(', ')} ou ${modes.at(-1)}`;
}

function isAccepted(sslmode: string | null, accepted: readonly SslMode[]) {
  return accepted.some(mode => mode === sslmode);
}

export function checkDatabaseUrl(
  value: string,
  acceptedSslModes: readonly SslMode[] = ENCRYPTED_SSL_MODES,
): DatabaseUrlCheck {
  const url = parseUrl(value);
  if (!url || !PROTOCOLS.has(url.protocol)) {
    return { valid: false, problem: 'deve ser uma URL postgresql:// válida' };
  }
  if (!isAccepted(url.searchParams.get('sslmode'), acceptedSslModes)) {
    return {
      valid: false,
      problem: `deve exigir TLS com ${listModes(acceptedSslModes)}`,
    };
  }
  const schema = url.searchParams.get('schema');
  if (!schema || !SCHEMA_PATTERN.test(schema)) {
    return {
      valid: false,
      problem: 'deve indicar o schema, por exemplo schema=fiap_school',
    };
  }
  return { valid: true, schema };
}

export function assertDatabaseUrl(name: string, value: string): string {
  const check = checkDatabaseUrl(value);
  if (!check.valid) {
    throw new Error(`Variável de ambiente inválida: ${name} ${check.problem}.`);
  }
  return check.schema;
}
