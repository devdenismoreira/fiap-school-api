import type { Guardian, GuardianCredentials } from '@/domain/entities/Guardian';
import type { Student } from '@/domain/entities/Student';

export interface GuardianRepository {
  findById(id: number): Promise<Guardian | null>;
  findByCpf(cpf: string): Promise<GuardianCredentials | null>;
  findLinkedStudent(guardianId: number, rm: number): Promise<Student | null>;
}
