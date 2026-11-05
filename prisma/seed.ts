import { createPrismaClient } from '@/infra/database/prismaClient';
import { seedDatabase } from '@/infra/database/seed/seedDatabase';
import { loadSeedSource, SeedError } from '@/infra/database/seed/seedSource';
import { describeSeedTarget, loadSeedEnv } from '@/main/config/seedEnv';

const silentLogger = { info: () => undefined, error: () => undefined };

function describeFailure(error: unknown): string {
  if (error instanceof SeedError) {
    return error.message;
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return `${error.name}${typeof code === 'string' ? ` ${code}` : ''}`;
  }
  return 'erro inesperado';
}

async function main(): Promise<void> {
  const env = loadSeedEnv(process.env, process.argv.slice(2));
  console.log(`Seed: destino ${describeSeedTarget(env)}.`);
  const source = loadSeedSource(env.sourcePath);
  const prisma = createPrismaClient(env.database, silentLogger);
  try {
    const counts = await seedDatabase(prisma, source, {
      bcryptCost: env.bcryptCost,
      schema: env.database.schema,
    });
    console.log(
      `Seed concluído: ${counts.responsaveis} responsáveis, ${counts.alunos} alunos, ${counts.dias} dias, ${counts.aulas} aulas, ${counts.boletins} boletins, ${counts.notas} notas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Seed abortado: ${describeFailure(error)}`);
  process.exitCode = 1;
});
