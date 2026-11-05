import type { ReportCard } from '@/domain/entities/ReportCard';
import type { ScheduleDay } from '@/domain/entities/ScheduleDay';
import type { Student } from '@/domain/entities/Student';
import { StudentNotFoundError } from '@/domain/errors/DomainErrors';
import type { Logger } from '@/domain/ports/Logger';
import type { GuardianRepository } from '@/domain/repositories/GuardianRepository';

export type StudentRecordsDependencies = Readonly<{
  guardians: GuardianRepository;
  logger: Logger;
}>;

export type GetStudentSchedule = (
  guardianId: number,
  rm: number,
) => Promise<readonly ScheduleDay[]>;

export type GetStudentReportCards = (
  guardianId: number,
  rm: number,
) => Promise<readonly ReportCard[]>;

function linkedStudentFinder({
  guardians,
  logger,
}: StudentRecordsDependencies) {
  return async (guardianId: number, rm: number): Promise<Student> => {
    const student = await guardians.findLinkedStudent(guardianId, rm);
    if (!student) {
      logger.info(
        { evento: 'acesso_aluno_negado', responsavelId: guardianId, rm },
        'Acesso a aluno não vinculado recusado',
      );
      throw new StudentNotFoundError();
    }
    return student;
  };
}

export function createGetStudentSchedule(
  dependencies: StudentRecordsDependencies,
): GetStudentSchedule {
  const findLinkedStudent = linkedStudentFinder(dependencies);
  return async (guardianId, rm) =>
    (await findLinkedStudent(guardianId, rm)).schedule;
}

export function createGetStudentReportCards(
  dependencies: StudentRecordsDependencies,
): GetStudentReportCards {
  const findLinkedStudent = linkedStudentFinder(dependencies);
  return async (guardianId, rm) =>
    (await findLinkedStudent(guardianId, rm)).reportCards;
}
