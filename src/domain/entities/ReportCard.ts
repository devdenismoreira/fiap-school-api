import type { Term } from './Term';

export type ReportCard = Readonly<{
  year: string;
  className: string;
  terms: readonly Term[];
}>;
