import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { get as httpGet, type Server } from 'node:http';
import { get as httpsGet } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from './httpServer';

function listener(
  _request: unknown,
  response: { end: (body: string) => void },
) {
  response.end('ok');
}

function listen(server: Server): Promise<number> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()));
}

function selfSignedCertificate() {
  const directory = mkdtempSync(join(tmpdir(), 'https-local-'));
  const keyPath = join(directory, 'localhost.key');
  const certPath = join(directory, 'localhost.crt');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' },
  );
  return { keyPath, certPath };
}

describe('createServer', () => {
  it('sobe em HTTP sem certificado local', async () => {
    const server = createServer(listener, null);
    const port = await listen(server);

    const body = await new Promise<string>((resolve, reject) => {
      httpGet(`http://127.0.0.1:${port}/`, response => {
        let data = '';
        response.on('data', (chunk: Buffer) => (data += chunk.toString()));
        response.on('end', () => resolve(data));
      }).on('error', reject);
    });

    expect(body).toBe('ok');
    await close(server);
  });

  it('sobe em HTTPS com HTTPS_KEY_PATH e HTTPS_CERT_PATH, com certificado verificável', async () => {
    const tls = selfSignedCertificate();
    const server = createServer(listener, tls);
    const port = await listen(server);

    const body = await new Promise<string>((resolve, reject) => {
      httpsGet(
        `https://127.0.0.1:${port}/`,
        { ca: readFileSync(tls.certPath) },
        response => {
          let data = '';
          response.on('data', (chunk: Buffer) => (data += chunk.toString()));
          response.on('end', () => resolve(data));
        },
      ).on('error', reject);
    });

    expect(body).toBe('ok');
    await close(server);
  });
});
