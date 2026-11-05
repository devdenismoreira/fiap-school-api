import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { createHttpLogger, createLogger } from './logger';

const SECRETS = {
  cpf: '00000000001',
  senha: 'senha-ficticia-123',
  accessToken: 'eyJhbGciOiJFUzI1NiJ9.token-ficticio.assinatura',
  refreshToken: 'refresh-ficticio-abcdefghijklmnopqrstuvwxyz',
  databaseUrl: 'postgresql://usuario:senha-do-banco@host:6543/postgres',
};

function memoryDestination() {
  const lines: string[] = [];
  const destination: DestinationStream = {
    write: (line: string) => {
      lines.push(line);
    },
  };
  return { lines, destination };
}

function expectNoSecrets(output: string): void {
  for (const secret of Object.values(SECRETS)) {
    expect(output).not.toContain(secret);
  }
}

describe('createLogger', () => {
  it('oculta CPF, senha, tokens e URL do banco nos objetos registrados', () => {
    const { lines, destination } = memoryDestination();
    const logger = createLogger('info', destination);

    logger.info(
      {
        req: {
          headers: { authorization: `Bearer ${SECRETS.accessToken}` },
          body: {
            cpf: SECRETS.cpf,
            senha: SECRETS.senha,
            refreshToken: SECRETS.refreshToken,
          },
        },
        tokens: {
          accessToken: SECRETS.accessToken,
          refreshToken: SECRETS.refreshToken,
        },
        login: { cpf: SECRETS.cpf, senha: SECRETS.senha },
        DATABASE_URL: SECRETS.databaseUrl,
        config: { DATABASE_URL: SECRETS.databaseUrl },
      },
      'evento',
    );

    const output = lines.join('');
    expectNoSecrets(output);
    expect(output).toContain('[oculto]');
  });
});

function serverWith(
  destination: DestinationStream,
  statusFor: (url: string) => number,
) {
  const httpLogger = createHttpLogger(createLogger('info', destination));
  return (incoming: IncomingMessage, outgoing: ServerResponse) => {
    httpLogger(incoming, outgoing);
    incoming.resume();
    incoming.on('end', () => {
      outgoing.statusCode = statusFor(incoming.url ?? '');
      outgoing.end();
    });
  };
}

describe('createHttpLogger', () => {
  it('registra a requisição sem o cabeçalho Authorization nem o corpo de autenticação', async () => {
    const { lines, destination } = memoryDestination();

    await request(serverWith(destination, () => 401))
      .post('/v1/auth/login')
      .set('Authorization', `Bearer ${SECRETS.accessToken}`)
      .send({ cpf: SECRETS.cpf, senha: SECRETS.senha });

    const output = lines.join('');
    expect(output).toContain('/v1/auth/login');
    expect(output).toContain('"authorization":"[oculto]"');
    expectNoSecrets(output);
  });

  it('usa nível warn para 4xx e error para 5xx', async () => {
    const { lines, destination } = memoryDestination();
    const server = serverWith(destination, url =>
      url === '/servidor' ? 500 : 404,
    );

    await request(server).get('/cliente');
    await request(server).get('/servidor');

    const levels = lines.map(
      line => (JSON.parse(line) as { level: number }).level,
    );
    expect(levels).toEqual([40, 50]);
  });
});
