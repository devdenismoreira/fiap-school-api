import { z } from 'zod';

export const studentParamsSchema = z.object({
  rm: z
    .string()
    .regex(/^[1-9]\d{0,8}$/)
    .transform(Number),
});

export type StudentParams = z.output<typeof studentParamsSchema>;
