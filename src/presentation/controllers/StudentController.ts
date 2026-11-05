import type { Request, Response } from 'express';
import type {
  GetStudentReportCards,
  GetStudentSchedule,
} from '@/domain/usecases/studentRecords';
import { authenticatedContext } from '@/presentation/middlewares/requireAuth';
import type { StudentParams } from '@/presentation/schemas/studentSchemas';
import {
  studentReportCardsView,
  studentScheduleView,
} from '@/presentation/views/studentViews';

export class StudentController {
  constructor(
    private readonly getSchedule: GetStudentSchedule,
    private readonly getReportCards: GetStudentReportCards,
  ) {}

  readonly schedule = async (_request: Request, response: Response) => {
    const { guardianId } = authenticatedContext(response);
    const { rm } = response.locals.params as StudentParams;
    const days = await this.getSchedule(guardianId, rm);
    response.status(200).json(studentScheduleView(days));
  };

  readonly reportCards = async (_request: Request, response: Response) => {
    const { guardianId } = authenticatedContext(response);
    const { rm } = response.locals.params as StudentParams;
    const cards = await this.getReportCards(guardianId, rm);
    response.status(200).json(studentReportCardsView(cards));
  };
}
