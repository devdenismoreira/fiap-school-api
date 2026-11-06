import type { StudentSummary } from './Student';

export type Guardian = Readonly<{
  id: number;
  firstName: string;
  lastName: string;
  students: readonly StudentSummary[];
}>;

export type GuardianCredentials = Readonly<{
  guardianId: number;
  passwordHash: string;
}>;
