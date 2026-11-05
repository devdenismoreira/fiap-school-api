import { compare, hash } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { PasswordHasher } from '@/domain/ports/PasswordHasher';

export class BcryptPasswordHasher implements PasswordHasher {
  private constructor(private readonly dummyHash: string) {}

  static async create(cost: number): Promise<BcryptPasswordHasher> {
    const dummyHash = await hash(randomBytes(32).toString('base64url'), cost);
    return new BcryptPasswordHasher(dummyHash);
  }

  async verify(
    password: string,
    passwordHash: string | null,
  ): Promise<boolean> {
    const matches = await compare(password, passwordHash ?? this.dummyHash);
    return passwordHash !== null && matches;
  }
}
