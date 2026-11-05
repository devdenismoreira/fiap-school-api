import type { ReportCard } from '@/domain/entities/ReportCard';

export type SubjectGradeView = Readonly<{
  nome: string;
  nota: number | null;
  faltas: number | null;
}>;

export type TermView = Readonly<{
  trimestre: number;
  disciplinas: readonly SubjectGradeView[];
}>;

export type ReportCardView = Readonly<{
  ano: string;
  turma: string;
  trimestres: readonly TermView[];
}>;

export function reportCardsView(
  reportCards: readonly ReportCard[],
): readonly ReportCardView[] {
  return reportCards.map(card => ({
    ano: card.year,
    turma: card.className,
    trimestres: card.terms.map(term => ({
      trimestre: term.number,
      disciplinas: term.grades.map(grade => ({
        nome: grade.subject,
        nota: grade.grade,
        faltas: grade.absences,
      })),
    })),
  }));
}
