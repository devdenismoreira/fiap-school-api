import type { SubjectGrade } from './SubjectGrade';

export type Term = Readonly<{
  number: number;
  grades: readonly SubjectGrade[];
}>;
