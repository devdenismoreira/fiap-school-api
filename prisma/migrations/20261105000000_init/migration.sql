-- CreateTable
CREATE TABLE "responsaveis" (
    "id" SERIAL NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "primeiro_nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alunos" (
    "rm" INTEGER NOT NULL,
    "turma" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "primeiro_nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("rm")
);

-- CreateTable
CREATE TABLE "responsavel_aluno" (
    "responsavel_id" INTEGER NOT NULL,
    "aluno_rm" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "responsavel_aluno_pkey" PRIMARY KEY ("responsavel_id","aluno_rm")
);

-- CreateTable
CREATE TABLE "dias_agenda" (
    "id" SERIAL NOT NULL,
    "aluno_rm" INTEGER NOT NULL,
    "dia" DATE NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "dias_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" SERIAL NOT NULL,
    "dia_agenda_id" INTEGER NOT NULL,
    "horario" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boletins" (
    "id" SERIAL NOT NULL,
    "aluno_rm" INTEGER NOT NULL,
    "ano" CHAR(4) NOT NULL,
    "turma" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "boletins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trimestres" (
    "id" SERIAL NOT NULL,
    "boletim_id" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,

    CONSTRAINT "trimestres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "id" SERIAL NOT NULL,
    "trimestre_id" INTEGER NOT NULL,
    "disciplina" TEXT NOT NULL,
    "nota" DECIMAL(4,1),
    "faltas" INTEGER,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "responsavel_id" INTEGER NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMP(3),
    "motivo_revogacao" TEXT,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usado_em" TIMESTAMP(3),
    "substituido_por" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "responsaveis_cpf_key" ON "responsaveis"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_aluno_responsavel_id_ordem_key" ON "responsavel_aluno"("responsavel_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "dias_agenda_aluno_rm_dia_key" ON "dias_agenda"("aluno_rm", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_dia_agenda_id_ordem_key" ON "aulas"("dia_agenda_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "boletins_aluno_rm_ano_key" ON "boletins"("aluno_rm", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "trimestres_boletim_id_trimestre_key" ON "trimestres"("boletim_id", "trimestre");

-- CreateIndex
CREATE UNIQUE INDEX "notas_trimestre_id_ordem_key" ON "notas"("trimestre_id", "ordem");

-- CreateIndex
CREATE INDEX "sessoes_responsavel_id_idx" ON "sessoes"("responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_sessao_id_idx" ON "refresh_tokens"("sessao_id");

-- AddForeignKey
ALTER TABLE "responsavel_aluno" ADD CONSTRAINT "responsavel_aluno_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsavel_aluno" ADD CONSTRAINT "responsavel_aluno_aluno_rm_fkey" FOREIGN KEY ("aluno_rm") REFERENCES "alunos"("rm") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dias_agenda" ADD CONSTRAINT "dias_agenda_aluno_rm_fkey" FOREIGN KEY ("aluno_rm") REFERENCES "alunos"("rm") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_dia_agenda_id_fkey" FOREIGN KEY ("dia_agenda_id") REFERENCES "dias_agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletins" ADD CONSTRAINT "boletins_aluno_rm_fkey" FOREIGN KEY ("aluno_rm") REFERENCES "alunos"("rm") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trimestres" ADD CONSTRAINT "trimestres_boletim_id_fkey" FOREIGN KEY ("boletim_id") REFERENCES "boletins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_trimestre_id_fkey" FOREIGN KEY ("trimestre_id") REFERENCES "trimestres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "responsaveis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alunos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "responsavel_aluno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dias_agenda" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aulas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boletins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trimestres" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
