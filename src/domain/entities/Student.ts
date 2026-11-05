import type { ReportCard } from './ReportCard';
import type { ScheduleDay } from './ScheduleDay';

export type Student = Readonly<{
  rm: number;
  className: string;
  shift: string;
  firstName: string;
  lastName: string;
  schedule: readonly ScheduleDay[];
  reportCards: readonly ReportCard[];
}>;
