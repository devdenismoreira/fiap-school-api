import type { ReportCard } from './ReportCard';
import type { ScheduleDay } from './ScheduleDay';

export type StudentSummary = Readonly<{
  rm: number;
  className: string;
  shift: string;
  firstName: string;
  lastName: string;
}>;

export type Student = StudentSummary &
  Readonly<{
    schedule: readonly ScheduleDay[];
    reportCards: readonly ReportCard[];
  }>;
