import { readFileSync } from 'node:fs';
import {
  createServer as createPlainServer,
  type RequestListener,
  type Server,
} from 'node:http';
import { createServer as createTlsServer } from 'node:https';

export type TlsFiles = Readonly<{ keyPath: string; certPath: string }>;

export function createServer(
  listener: RequestListener,
  tls: TlsFiles | null,
): Server {
  if (!tls) {
    return createPlainServer(listener);
  }
  return createTlsServer(
    { key: readFileSync(tls.keyPath), cert: readFileSync(tls.certPath) },
    listener,
  );
}
