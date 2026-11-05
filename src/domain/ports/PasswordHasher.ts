export interface PasswordHasher {
  verify(password: string, passwordHash: string | null): Promise<boolean>;
}
