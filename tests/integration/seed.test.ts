import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaGuardianRepository } from '@/infra/database/repositories/PrismaGuardianRepository';
import { countSource, seedDatabase } from '@/infra/database/seed/seedDatabase';
import { loadEnv } from '@/main/config/env';
import { loadSourceForTests } from '../support/seedSourceForTests';

const MODEL_TABLES = [
  'responsaveis',
  'alunos',
  'responsavel_aluno',
  'dias_agenda',
  'aulas',
  'boletins',
  'trimestres',
  'notas',
  'sessoes',
  'refresh_tokens',
];

const logger = { info: jest.fn(), error: jest.fn() };
const { database } = loadEnv(process.env);
const prisma = createPrismaClient(database, logger);
const repository = new PrismaGuardianRepository(prisma);
const source = loadSourceForTests();

afterAll(() => prisma.$disconnect());

async function countDatabase() {
  return {
    responsaveis: await prisma.guardian.count(),
    alunos: await prisma.student.count(),
    dias: await prisma.scheduleDay.count(),
    aulas: await prisma.lesson.count(),
    boletins: await prisma.reportCard.count(),
    notas: await prisma.subjectGrade.count(),
  };
}

async function snapshot() {
  return Promise.all(source.map(guardian => repository.findById(guardian.id)));
}

describe('seed no schema de teste', () => {
  it('grava as mesmas contagens da fonte', async () => {
    await expect(countDatabase()).resolves.toEqual(countSource(source));
  });

  it('mantém os ids dos responsáveis da fonte', async () => {
    const rows = await prisma.guardian.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    expect(rows.map(row => row.id)).toEqual(
      source.map(guardian => guardian.id).sort((a, b) => a - b),
    );
  });

  it('grava as senhas só como hash bcrypt de custo 12', async () => {
    const rows = await prisma.guardian.findMany({
      select: { id: true, passwordHash: true },
    });

    for (const row of rows) {
      const plain = source.find(guardian => guardian.id === row.id)?.senha;
      expect(row.passwordHash.startsWith('$2b$12$')).toBe(true);
      expect(row.passwordHash).not.toBe(plain);
    }
  });

  it('ajusta a sequência de ids dos responsáveis ao maior id da fonte', async () => {
    const table = `"${database.schema}"."responsaveis"`;
    const [row] = await prisma.$queryRaw<{ last_value: bigint }[]>`
      SELECT last_value FROM pg_sequences
      WHERE schemaname = ${database.schema}
        AND sequencename = split_part(pg_get_serial_sequence(${table}, 'id'), '.', 2)`;

    expect(Number(row?.last_value)).toBe(
      Math.max(...source.map(guardian => guardian.id)),
    );
  });

  it('é idempotente: rodar de novo produz o mesmo estado', async () => {
    const before = await snapshot();
    const countsBefore = await countDatabase();

    await seedDatabase(prisma, source, {
      bcryptCost: 12,
      schema: database.schema,
    });

    await expect(snapshot()).resolves.toStrictEqual(before);
    await expect(countDatabase()).resolves.toEqual(countsBefore);
  });

  it('o comando yarn db:seed mostra só destino e contagens, sem dados pessoais', () => {
    const result = spawnSync('yarn', ['-s', 'db:seed'], {
      cwd: resolve(__dirname, '..', '..'),
      env: process.env,
      encoding: 'utf8',
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain('Seed concluído');
    const personalData = source.flatMap(guardian => [
      guardian.cpf,
      guardian.email,
      guardian.senha,
      guardian.primeiroNome,
      guardian.sobrenome,
      ...guardian.alunos.flatMap(student => [
        student.primeiroNome,
        student.sobrenome,
      ]),
    ]);
    const leaked = personalData.filter(value => output.includes(value));
    expect(leaked).toHaveLength(0);
  });

  it('deixa o RLS ativado em todas as tabelas do modelo', async () => {
    const rows = await prisma.$queryRaw<
      { relname: string; relrowsecurity: boolean }[]
    >`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${database.schema} AND c.relkind = 'r'`;

    const security = new Map(
      rows.map(row => [row.relname, row.relrowsecurity]),
    );
    for (const table of MODEL_TABLES) {
      expect({ table, rls: security.get(table) }).toEqual({
        table,
        rls: true,
      });
    }
  });
});
