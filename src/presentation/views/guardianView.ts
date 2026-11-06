import type { Guardian } from '@/domain/entities/Guardian';
import type { StudentSummary } from '@/domain/entities/Student';

export type StudentView = Readonly<{
  rm: number;
  turma: string;
  periodo: string;
  primeiroNome: string;
  sobrenome: string;
}>;

export type GuardianView = Readonly<{
  id: number;
  primeiroNome: string;
  sobrenome: string;
  alunos: readonly StudentView[];
}>;

function studentView(student: StudentSummary): StudentView {
  return {
    rm: student.rm,
    turma: student.className,
    periodo: student.shift,
    primeiroNome: student.firstName,
    sobrenome: student.lastName,
  };
}

export function guardianView(guardian: Guardian): GuardianView {
  return {
    id: guardian.id,
    primeiroNome: guardian.firstName,
    sobrenome: guardian.lastName,
    alunos: guardian.students.map(studentView),
  };
}
