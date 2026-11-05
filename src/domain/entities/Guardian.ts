import type { Student } from './Student';

export type Guardian = Readonly<{
  id: number;
  firstName: string;
  lastName: string;
  students: readonly Student[];
}>;

export type GuardianCredentials = Readonly<{
  guardianId: number;
  passwordHash: string;
}>;
