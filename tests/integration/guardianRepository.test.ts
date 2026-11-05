import { compare } from 'bcrypt';
import { createPrismaClient } from '@/infra/database/prismaClient';
import { PrismaGuardianRepository } from '@/infra/database/repositories/PrismaGuardianRepository';
import { loadEnv } from '@/main/config/env';
import { guardianView } from '@/presentation/views/guardianView';
import { reportCardsView } from '@/presentation/views/reportCardsView';
import { scheduleView } from '@/presentation/views/scheduleView';
import {
  loadSourceForTests,
  withoutCredentials,
} from '../support/seedSourceForTests';

const logger = { info: jest.fn(), error: jest.fn() };
const prisma = createPrismaClient(loadEnv(process.env).database, logger);
const repository = new PrismaGuardianRepository(prisma);
const source = loadSourceForTests();
const guardianIds = source.map(guardian => guardian.id);
const allRms = source.flatMap(guardian => guardian.alunos.map(s => s.rm));

afterAll(() => prisma.$disconnect());

describe('PrismaGuardianRepository.findById', () => {
  it.each(guardianIds)(
    'devolve o responsável %i igual à fonte, sem credenciais, na mesma ordem e com os null',
    async id => {
      const expected = source.find(guardian => guardian.id === id);
      const guardian = await repository.findById(id);

      expect(guardian).not.toBeNull();
      expect(expected).toBeDefined();
      expect(guardianView(guardian!)).toStrictEqual(
        withoutCredentials(expected!),
      );
    },
  );

  it('devolve null para id inexistente', async () => {
    await expect(
      repository.findById(Math.max(...guardianIds) + 1000),
    ).resolves.toBeNull();
  });
});

describe('PrismaGuardianRepository.findByCpf', () => {
  it.each(guardianIds)(
    'encontra o responsável %i pelo CPF e a senha da fonte confere com o hash',
    async id => {
      const expected = source.find(guardian => guardian.id === id)!;
      const credentials = await repository.findByCpf(expected.cpf);

      expect(credentials?.guardianId).toBe(id);
      await expect(
        compare(expected.senha, credentials?.passwordHash ?? ''),
      ).resolves.toBe(true);
    },
  );

  it('devolve null para CPF não cadastrado', async () => {
    await expect(repository.findByCpf('00000000000')).resolves.toBeNull();
  });
});

describe('PrismaGuardianRepository.findLinkedStudent', () => {
  const pairs = guardianIds.flatMap(guardianId =>
    allRms.map(rm => ({ guardianId, rm })),
  );

  it.each(pairs)(
    'responsável $guardianId e RM $rm: só devolve o aluno se houver vínculo',
    async ({ guardianId, rm }) => {
      const guardian = source.find(item => item.id === guardianId)!;
      const linked = guardian.alunos.find(student => student.rm === rm);

      const student = await repository.findLinkedStudent(guardianId, rm);

      if (!linked) {
        expect(student).toBeNull();
        return;
      }
      expect(student).not.toBeNull();
      expect(scheduleView(student!.schedule)).toStrictEqual(linked.agenda);
      expect(reportCardsView(student!.reportCards)).toStrictEqual(
        linked.boletim,
      );
    },
  );

  it('devolve null para RM inexistente', async () => {
    await expect(
      repository.findLinkedStudent(guardianIds[0]!, Math.max(...allRms) + 1),
    ).resolves.toBeNull();
  });
});
