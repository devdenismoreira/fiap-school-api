import type { Student } from '@/domain/entities/Student';
import { StudentNotFoundError } from '@/domain/errors/DomainErrors';
import {
  createGetStudentReportCards,
  createGetStudentSchedule,
} from './studentRecords';

const student: Student = {
  rm: 900001,
  className: '7EF',
  shift: 'Matutino',
  firstName: 'Bia',
  lastName: 'Exemplo',
  schedule: [{ date: '2025-03-16', lessons: [] }],
  reportCards: [{ year: '2025', className: '7EF', terms: [] }],
};

function setup() {
  const findLinkedStudent = jest.fn((guardianId: number, rm: number) =>
    Promise.resolve(guardianId === 7 && rm === 900001 ? student : null),
  );
  const logger = { info: jest.fn(), error: jest.fn() };
  const dependencies = {
    guardians: { findById: jest.fn(), findByCpf: jest.fn(), findLinkedStudent },
    logger,
  };
  return {
    getSchedule: createGetStudentSchedule(dependencies),
    getReportCards: createGetStudentReportCards(dependencies),
    findLinkedStudent,
    logger,
  };
}

describe('casos de uso de aluno', () => {
  it('devolvem a agenda e os boletins do aluno vinculado, consultando pelo par responsável e RM', async () => {
    const { getSchedule, getReportCards, findLinkedStudent } = setup();

    await expect(getSchedule(7, 900001)).resolves.toBe(student.schedule);
    await expect(getReportCards(7, 900001)).resolves.toBe(student.reportCards);
    expect(findLinkedStudent).toHaveBeenCalledWith(7, 900001);
  });

  it.each([
    ['de outro responsável', 8, 900001],
    ['inexistente', 7, 999999],
  ])(
    'aluno %s gera StudentNotFoundError e registra o evento só com responsavelId e RM',
    async (_caso, guardianId, rm) => {
      const { getSchedule, getReportCards, logger } = setup();

      await expect(getSchedule(guardianId, rm)).rejects.toBeInstanceOf(
        StudentNotFoundError,
      );
      await expect(getReportCards(guardianId, rm)).rejects.toBeInstanceOf(
        StudentNotFoundError,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { evento: 'acesso_aluno_negado', responsavelId: guardianId, rm },
        'Acesso a aluno não vinculado recusado',
      );
    },
  );
});
