export type SubjectGrade = Readonly<{
  subject: string;
  grade: number | null;
  absences: number | null;
}>;
