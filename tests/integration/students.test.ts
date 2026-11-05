import { decodeJwt } from 'jose';
import request from 'supertest';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaSessionRepository } from '@/infra/database/repositories/PrismaSessionRepository';
import { loadDatabaseEnv, loadEnv } from '@/main/config/env';
import { createDependencies, type Dependencies } from '@/main/dependencies';
import { loadSourceForTests } from '../support/seedSourceForTests';

const env = loadEnv(process.env);
const source = loadSourceForTests();
const allRms = [
  ...new Set(source.flatMap(guardian => guardian.alunos.map(s => s.rm))),
];
const unknownRm = Math.max(...allRms) + 1;
const prisma = createPrismaClient(loadDatabaseEnv(process.env).database, {
  info: () => undefined,
  error: () => undefined,
});

const notFound = {
  erro: { codigo: 'ALUNO_NAO_ENCONTRADO', mensagem: 'Aluno não encontrado.' },
};

async function tokenOf(api: Dependencies, guardian: (typeof source)[number]) {
  const response = await request(api.app)
    .post('/v1/auth/login')
    .send({ cpf: guardian.cpf, senha: guardian.senha })
    .expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

function getStudent(
  api: Dependencies,
  token: string,
  rm: number | string,
  resource: 'agenda' | 'boletins',
) {
  return request(api.app)
    .get(`/v1/alunos/${rm}/${resource}`)
    .set('Authorization', `Bearer ${token}`);
}

afterAll(() => prisma.$disconnect());

describe('autorização pelo vínculo: todos os RMs com o token de cada responsável', () => {
  let api: Dependencies;
  const tokens = new Map<number, string>();
  beforeAll(async () => {
    api = await createDependencies(env);
    for (const guardian of source) {
      tokens.set(guardian.id, await tokenOf(api, guardian));
    }
  });
  afterAll(() => api.close());

  const cases = source.flatMap(guardian =>
    allRms.map(rm => ({ guardianId: guardian.id, rm })),
  );

  it.each(cases)(
    'responsável $guardianId e RM $rm: só recebe os dados se o aluno for vinculado',
    async ({ guardianId, rm }) => {
      const guardian = source.find(item => item.id === guardianId)!;
      const linked = guardian.alunos.find(student => student.rm === rm);
      const token = tokens.get(guardianId)!;

      const agenda = await getStudent(api, token, rm, 'agenda');
      const boletins = await getStudent(api, token, rm, 'boletins');

      for (const response of [agenda, boletins]) {
        expect(response.headers['cache-control']).toBe('no-store');
      }
      if (!linked) {
        expect(agenda.status).toBe(404);
        expect(agenda.body).toEqual(notFound);
        expect(boletins.status).toBe(404);
        expect(boletins.body).toEqual(notFound);
        return;
      }
      expect(agenda.status).toBe(200);
      expect(agenda.body).toStrictEqual({ agenda: linked.agenda });
      expect(boletins.status).toBe(200);
      expect(boletins.body).toStrictEqual({ boletins: linked.boletim });
    },
  );

  it('RM inexistente e RM de outro responsável recebem respostas idênticas', async () => {
    const [owner, other] = source;
    const othersRm = other!.alunos.find(
      student => !owner!.alunos.some(own => own.rm === student.rm),
    )!.rm;
    const token = tokens.get(owner!.id)!;

    for (const resource of ['agenda', 'boletins'] as const) {
      const fromOther = await getStudent(api, token, othersRm, resource);
      const missing = await getStudent(api, token, unknownRm, resource);

      expect(fromOther.status).toBe(missing.status);
      expect(fromOther.text).toBe(missing.text);
    }
  });

  it.each(['abc', '-1', '0', '012345', '1e3', '1000000000'])(
    'RM inválido (%s) recebe 400 DADOS_INVALIDOS',
    async rm => {
      const token = tokens.get(source[0]!.id)!;

      const response = await getStudent(api, token, rm, 'agenda');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos.' },
      });
    },
  );
});

describe('rotas de aluno sem autenticação válida', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await createDependencies(env);
  });
  afterAll(() => api.close());

  const ownRm = source[0]!.alunos[0]!.rm;

  it('sem token recebe 401, antes mesmo de validar o RM', async () => {
    const valid = await request(api.app).get(`/v1/alunos/${ownRm}/agenda`);
    const invalidRm = await request(api.app).get('/v1/alunos/abc/agenda');

    expect(valid.status).toBe(401);
    expect(invalidRm.status).toBe(401);
  });

  it('token inválido recebe 401 TOKEN_INVALIDO', async () => {
    const response = await getStudent(api, 'aaa.bbb.ccc', ownRm, 'boletins');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ erro: { codigo: 'TOKEN_INVALIDO' } });
  });

  it('token de sessão revogada recebe 401', async () => {
    const token = await tokenOf(api, source[0]!);
    await getStudent(api, token, ownRm, 'agenda').expect(200);

    await new PrismaSessionRepository(prisma).revoke(
      decodeJwt(token).sid as string,
      'logout',
      new Date(),
    );

    expect((await getStudent(api, token, ownRm, 'agenda')).status).toBe(401);
  });
});

describe('log do acesso negado', () => {
  it('registra responsavelId e RM pedido, sem dados do aluno', async () => {
    const lines: string[] = [];
    const api = await createDependencies(
      { ...env, logLevel: 'info' },
      {
        logDestination: {
          write: (line: string) => {
            lines.push(line);
          },
        },
      },
    );

    try {
      const [owner, other] = source;
      const foreign = other!.alunos.find(
        student => !owner!.alunos.some(own => own.rm === student.rm),
      )!;
      const token = await tokenOf(api, owner!);

      await getStudent(api, token, foreign.rm, 'agenda').expect(404);

      const output = lines.join('');
      expect(output).toContain('"evento":"acesso_aluno_negado"');
      expect(output).toContain(`"responsavelId":${owner!.id}`);
      expect(output).toContain(`"rm":${foreign.rm}`);
      const studentData = [
        foreign.primeiroNome,
        foreign.sobrenome,
        foreign.turma,
      ];
      expect(studentData.filter(value => output.includes(value))).toHaveLength(
        0,
      );
    } finally {
      await api.close();
    }
  });
});
