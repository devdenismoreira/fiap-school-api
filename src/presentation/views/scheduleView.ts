import type { ScheduleDay } from '@/domain/entities/ScheduleDay';

export type LessonView = Readonly<{ horario: string; disciplina: string }>;

export type ScheduleDayView = Readonly<{
  dia: string;
  aulas: readonly LessonView[];
}>;

export function scheduleView(
  days: readonly ScheduleDay[],
): readonly ScheduleDayView[] {
  return days.map(day => ({
    dia: day.date,
    aulas: day.lessons.map(lesson => ({
      horario: lesson.time,
      disciplina: lesson.subject,
    })),
  }));
}
