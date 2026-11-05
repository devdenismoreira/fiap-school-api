import type { Guardian } from '@/domain/entities/Guardian';
import type { Student } from '@/domain/entities/Student';
import { reportCardsView, type ReportCardView } from './reportCardsView';
import { scheduleView, type ScheduleDayView } from './scheduleView';

export type StudentView = Readonly<{
  rm: number;
  turma: string;
  periodo: string;
  primeiroNome: string;
  sobrenome: string;
  agenda: readonly ScheduleDayView[];
  boletim: readonly ReportCardView[];
}>;

export type GuardianView = Readonly<{
  id: number;
  primeiroNome: string;
  sobrenome: string;
  alunos: readonly StudentView[];
}>;

function studentView(student: Student): StudentView {
  return {
    rm: student.rm,
    turma: student.className,
    periodo: student.shift,
    primeiroNome: student.firstName,
    sobrenome: student.lastName,
    agenda: scheduleView(student.schedule),
    boletim: reportCardsView(student.reportCards),
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
