import type { Guardian, GuardianCredentials } from '@/domain/entities/Guardian';
import type { Student, StudentSummary } from '@/domain/entities/Student';
import type { GuardianRepository } from '@/domain/repositories/GuardianRepository';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

const studentInclude = {
  schedule: {
    orderBy: { position: 'asc' },
    include: { lessons: { orderBy: { position: 'asc' } } },
  },
  reportCards: {
    orderBy: { position: 'asc' },
    include: {
      terms: {
        orderBy: { number: 'asc' },
        include: { grades: { orderBy: { position: 'asc' } } },
      },
    },
  },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toSummary(row: Prisma.StudentGetPayload<object>): StudentSummary {
  return {
    rm: row.rm,
    className: row.className,
    shift: row.shift,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}

function toStudent(row: StudentRow): Student {
  return {
    ...toSummary(row),
    schedule: row.schedule.map(day => ({
      date: toIsoDate(day.date),
      lessons: day.lessons.map(lesson => ({
        time: lesson.time,
        subject: lesson.subject,
      })),
    })),
    reportCards: row.reportCards.map(card => ({
      year: card.year,
      className: card.className,
      terms: card.terms.map(term => ({
        number: term.number,
        grades: term.grades.map(grade => ({
          subject: grade.subject,
          grade: grade.grade === null ? null : grade.grade.toNumber(),
          absences: grade.absences,
        })),
      })),
    })),
  };
}

export class PrismaGuardianRepository implements GuardianRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: number): Promise<Guardian | null> {
    const row = await this.prisma.guardian.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        students: {
          orderBy: { position: 'asc' },
          select: { student: true },
        },
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      students: row.students.map(link => toSummary(link.student)),
    };
  }

  async findByCpf(cpf: string): Promise<GuardianCredentials | null> {
    const row = await this.prisma.guardian.findUnique({
      where: { cpf },
      select: { id: true, passwordHash: true },
    });
    return row ? { guardianId: row.id, passwordHash: row.passwordHash } : null;
  }

  async findLinkedStudent(
    guardianId: number,
    rm: number,
  ): Promise<Student | null> {
    const row = await this.prisma.student.findFirst({
      where: { rm, guardians: { some: { guardianId } } },
      include: studentInclude,
    });
    return row ? toStudent(row) : null;
  }
}
