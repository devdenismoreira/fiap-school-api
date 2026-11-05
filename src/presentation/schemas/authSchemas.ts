import { z } from 'zod';

const BCRYPT_MAX_BYTES = 72;

export const loginSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/),
  senha: z
    .string()
    .min(1)
    .refine(value => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES),
});

export type LoginBody = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
});

export type RefreshBody = z.infer<typeof refreshSchema>;
