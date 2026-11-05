import type { ReportCard } from '@/domain/entities/ReportCard';
import type { ScheduleDay } from '@/domain/entities/ScheduleDay';
import { reportCardsView, type ReportCardView } from './reportCardsView';
import { scheduleView, type ScheduleDayView } from './scheduleView';

export type StudentScheduleView = Readonly<{
  agenda: readonly ScheduleDayView[];
}>;

export type StudentReportCardsView = Readonly<{
  boletins: readonly ReportCardView[];
}>;

export function studentScheduleView(
  days: readonly ScheduleDay[],
): StudentScheduleView {
  return { agenda: scheduleView(days) };
}

export function studentReportCardsView(
  reportCards: readonly ReportCard[],
): StudentReportCardsView {
  return { boletins: reportCardsView(reportCards) };
}
