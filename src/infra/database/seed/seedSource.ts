import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const text = z.string().min(1);

const sourceSchema = z.array(
  z.strictObject({
    id: z.number().int().positive(),
    cpf: z.string().regex(/^\d{11}$/),
    email: text,
    senha: text,
    primeiroNome: text,
    sobrenome: text,
    alunos: z.array(
      z.strictObject({
        rm: z.number().int().positive(),
        turma: text,
        periodo: text,
        primeiroNome: text,
        sobrenome: text,
        agenda: z.array(
          z.strictObject({
            dia: z.iso.date(),
            aulas: z.array(z.strictObject({ horario: text, disciplina: text })),
          }),
        ),
        boletim: z.array(
          z.strictObject({
            ano: z.string().regex(/^\d{4}$/),
            turma: text,
            trimestres: z.array(
              z.strictObject({
                trimestre: z.number().int().positive(),
                disciplinas: z.array(
                  z.strictObject({
                    nome: text,
                    nota: z.number().min(0).max(999.9).nullable(),
                    faltas: z.number().int().min(0).nullable(),
                  }),
                ),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
);

export type SeedSource = z.infer<typeof sourceSchema>;
export type SeedGuardian = SeedSource[number];
export type SeedStudent = SeedGuardian['alunos'][number];

export class SeedError extends Error {
  override readonly name = 'SeedError';
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map(issue => `${issue.path.join('.') || '(raiz)'}: ${issue.code}`)
    .join('; ');
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new SeedError('O arquivo de origem do seed não é um JSON válido.');
  }
}

export function parseSeedSource(content: string): SeedSource {
  const result = sourceSchema.safeParse(parseJson(content));
  if (!result.success) {
    throw new SeedError(
      `O arquivo de origem do seed tem um formato inesperado: ${describeIssues(result.error)}.`,
    );
  }
  return result.data;
}

export function loadSeedSource(path: string): SeedSource {
  if (!existsSync(path)) {
    throw new SeedError(
      `Arquivo de origem do seed não encontrado em SEED_SOURCE_PATH (${path}).`,
    );
  }
  return parseSeedSource(readFileSync(path, 'utf8'));
}

export function uniqueStudents(source: SeedSource): readonly SeedStudent[] {
  const byRm = new Map<number, SeedStudent>();
  for (const student of source.flatMap(guardian => guardian.alunos)) {
    const known = byRm.get(student.rm);
    if (known && JSON.stringify(known) !== JSON.stringify(student)) {
      throw new SeedError(
        'Um mesmo RM aparece em mais de um responsável com dados diferentes.',
      );
    }
    byRm.set(student.rm, student);
  }
  return [...byRm.values()];
}
