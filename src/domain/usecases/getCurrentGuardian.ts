import type { Guardian } from '@/domain/entities/Guardian';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import type { GuardianRepository } from '@/domain/repositories/GuardianRepository';

export type GetCurrentGuardian = (guardianId: number) => Promise<Guardian>;

export function createGetCurrentGuardian(
  guardians: GuardianRepository,
): GetCurrentGuardian {
  return async guardianId => {
    const guardian = await guardians.findById(guardianId);
    if (!guardian) {
      throw new InvalidAccessTokenError();
    }
    return guardian;
  };
}
