import type { Lesson } from './Lesson';

export type ScheduleDay = Readonly<{
  date: string;
  lessons: readonly Lesson[];
}>;
