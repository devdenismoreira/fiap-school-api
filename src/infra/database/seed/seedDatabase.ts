import { hash } from 'bcrypt';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { uniqueStudents, type SeedSource } from './seedSource';

const TRANSACTION_TIMEOUT_MILLISECONDS = 60_000;

export type SeedCounts = Readonly<{
  responsaveis: number;
  alunos: number;
  dias: number;
  aulas: number;
  boletins: number;
  notas: number;
}>;

export type SeedOptions = Readonly<{ bcryptCost: number; schema: string }>;

type Transaction = Prisma.TransactionClient;

type GuardianWithHash = Readonly<{
  guardian: SeedSource[number];
  passwordHash: string;
}>;

function key(...parts: readonly (string | number)[]): string {
  return parts.join('|');
}

function idFor(ids: ReadonlyMap<string, number>, mapKey: string): number {
  const id = ids.get(mapKey);
  if (id === undefined) {
    throw new Error(`Registro pai ausente no seed (${mapKey}).`);
  }
  return id;
}

async function writeGuardians(
  tx: Transaction,
  guardians: readonly GuardianWithHash[],
): Promise<void> {
  await tx.guardian.createMany({
    data: guardians.map(({ guardian, passwordHash }) => ({
      id: guardian.id,
      cpf: guardian.cpf,
      email: guardian.email,
      passwordHash,
      firstName: guardian.primeiroNome,
      lastName: guardian.sobrenome,
    })),
  });
}

async function writeStudents(
  tx: Transaction,
  source: SeedSource,
): Promise<void> {
  const students = uniqueStudents(source);
  await tx.student.createMany({
    data: students.map(student => ({
      rm: student.rm,
      className: student.turma,
      shift: student.periodo,
      firstName: student.primeiroNome,
      lastName: student.sobrenome,
    })),
  });
  await tx.guardianStudent.createMany({
    data: source.flatMap(guardian =>
      guardian.alunos.map((student, position) => ({
        guardianId: guardian.id,
        studentRm: student.rm,
        position,
      })),
    ),
  });
}

async function writeSchedules(
  tx: Transaction,
  source: SeedSource,
): Promise<void> {
  const students = uniqueStudents(source);
  const days = await tx.scheduleDay.createManyAndReturn({
    data: students.flatMap(student =>
      student.agenda.map((day, position) => ({
        studentRm: student.rm,
        date: new Date(`${day.dia}T00:00:00.000Z`),
        position,
      })),
    ),
    select: { id: true, studentRm: true, date: true },
  });
  const dayIds = new Map(
    days.map(day => [
      key(day.studentRm, day.date.toISOString().slice(0, 10)),
      day.id,
    ]),
  );
  await tx.lesson.createMany({
    data: students.flatMap(student =>
      student.agenda.flatMap(day =>
        day.aulas.map((lesson, position) => ({
          scheduleDayId: idFor(dayIds, key(student.rm, day.dia)),
          time: lesson.horario,
          subject: lesson.disciplina,
          position,
        })),
      ),
    ),
  });
}

async function writeReportCards(
  tx: Transaction,
  source: SeedSource,
): Promise<void> {
  const students = uniqueStudents(source);
  const cards = await tx.reportCard.createManyAndReturn({
    data: students.flatMap(student =>
      student.boletim.map((card, position) => ({
        studentRm: student.rm,
        year: card.ano,
        className: card.turma,
        position,
      })),
    ),
    select: { id: true, studentRm: true, year: true },
  });
  const cardIds = new Map(
    cards.map(card => [key(card.studentRm, card.year), card.id]),
  );
  const terms = await tx.term.createManyAndReturn({
    data: students.flatMap(student =>
      student.boletim.flatMap(card =>
        card.trimestres.map(term => ({
          reportCardId: idFor(cardIds, key(student.rm, card.ano)),
          number: term.trimestre,
        })),
      ),
    ),
    select: { id: true, reportCardId: true, number: true },
  });
  const termIds = new Map(
    terms.map(term => [key(term.reportCardId, term.number), term.id]),
  );
  await tx.subjectGrade.createMany({
    data: students.flatMap(student =>
      student.boletim.flatMap(card =>
        card.trimestres.flatMap(term =>
          term.disciplinas.map((grade, position) => ({
            termId: idFor(
              termIds,
              key(idFor(cardIds, key(student.rm, card.ano)), term.trimestre),
            ),
            subject: grade.nome,
            grade: grade.nota,
            absences: grade.faltas,
            position,
          })),
        ),
      ),
    ),
  });
}

async function resetGuardianSequence(
  tx: Transaction,
  source: SeedSource,
  schema: string,
): Promise<void> {
  const maxId = Math.max(...source.map(guardian => guardian.id));
  const table = `"${schema}"."responsaveis"`;
  await tx.$executeRaw`SELECT setval(pg_get_serial_sequence(${table}, 'id'), ${maxId})`;
}

export function countSource(source: SeedSource): SeedCounts {
  const students = uniqueStudents(source);
  const days = students.flatMap(student => student.agenda);
  const cards = students.flatMap(student => student.boletim);
  return {
    responsaveis: source.length,
    alunos: students.length,
    dias: days.length,
    aulas: days.flatMap(day => day.aulas).length,
    boletins: cards.length,
    notas: cards.flatMap(card =>
      card.trimestres.flatMap(term => term.disciplinas),
    ).length,
  };
}

export async function seedDatabase(
  prisma: PrismaClient,
  source: SeedSource,
  options: SeedOptions,
): Promise<SeedCounts> {
  const guardians = await Promise.all(
    source.map(async guardian => ({
      guardian,
      passwordHash: await hash(guardian.senha, options.bcryptCost),
    })),
  );
  await prisma.$transaction(
    async tx => {
      await tx.guardian.deleteMany();
      await tx.student.deleteMany();
      await writeGuardians(tx, guardians);
      await writeStudents(tx, source);
      await writeSchedules(tx, source);
      await writeReportCards(tx, source);
      await resetGuardianSequence(tx, source, options.schema);
    },
    { timeout: TRANSACTION_TIMEOUT_MILLISECONDS },
  );
  return countSource(source);
}
