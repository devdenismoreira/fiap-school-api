# 02 — Modelo de dados

> Status: **aprovada em 2026-11-05** · Banco: PostgreSQL no Supabase (D-04 ✅), schema `fiap_school` (D-20 ✅) · ORM: Prisma (D-01 ✅)

## 1. Do JSON às tabelas

O JSON é um agregado aninhado. No banco ele é normalizado, e cada nível ganha `ordem` para que a API devolva os arrays na mesma sequência do JSON (D-06).

```text
responsaveis 1─N responsavel_aluno N─1 alunos
alunos 1─N dias_agenda 1─N aulas
alunos 1─N boletins 1─N trimestres 1─N notas
responsaveis 1─N sessoes 1─N refresh_tokens
```

| JSON | Tabela | Observação |
|---|---|---|
| responsável | `responsaveis` | `senha` vira `senha_hash` (bcrypt, D-09) |
| `alunos[]` | `alunos` + `responsavel_aluno` | Relação N:N: um aluno pode ter dois responsáveis. `ordem` preserva o primeiro aluno, que o app seleciona por padrão |
| `agenda[]` | `dias_agenda` | Tabela própria porque há **dias sem aula**, que precisam existir com `aulas: []` |
| `aulas[]` | `aulas` | `horario` mantém o texto `HH:MM - HH:MM` |
| `boletim[]` | `boletins` | `ano` em texto (`"2025"`); `turma` é a daquele ano |
| `trimestres[]` | `trimestres` | |
| `disciplinas[]` | `notas` | `nota` e `faltas` aceitam `NULL` ("não lançado") |

## 2. Esquema Prisma (proposta)

Os modelos têm nomes em inglês, como no domínio. As tabelas e colunas usam português `snake_case`. As tabelas ficam no schema `fiap_school`, escolhido pela URL de conexão (`?schema=fiap_school`), fora da Data API do Supabase (D-20).

No Prisma 7, a `datasource` não tem `url` nem `directUrl`: o CLI lê a `DIRECT_URL` no `prisma.config.ts`, e o cliente recebe a `DATABASE_URL` pelo adapter `pg` (D-24). A primeira migration é `prisma/migrations/20261105000000_init`, gerada com `prisma migrate diff` e sem schema fixo no SQL, para servir aos schemas `fiap_school` e `fiap_school_test`.

```prisma
datasource db {
  provider = "postgresql"
}

model Guardian {
  id           Int               @id @default(autoincrement())
  cpf          String            @unique @db.Char(11)
  email        String
  passwordHash String            @map("senha_hash")
  firstName    String            @map("primeiro_nome")
  lastName     String            @map("sobrenome")
  students     GuardianStudent[]
  sessions     Session[]

  @@map("responsaveis")
}

model Student {
  rm          Int               @id
  className   String            @map("turma")
  shift       String            @map("periodo")
  firstName   String            @map("primeiro_nome")
  lastName    String            @map("sobrenome")
  guardians   GuardianStudent[]
  schedule    ScheduleDay[]
  reportCards ReportCard[]

  @@map("alunos")
}

model GuardianStudent {
  guardianId Int      @map("responsavel_id")
  studentRm  Int      @map("aluno_rm")
  position   Int      @map("ordem")
  guardian   Guardian @relation(fields: [guardianId], references: [id], onDelete: Cascade)
  student    Student  @relation(fields: [studentRm], references: [rm], onDelete: Cascade)

  @@id([guardianId, studentRm])
  @@unique([guardianId, position])
  @@map("responsavel_aluno")
}

model ScheduleDay {
  id        Int      @id @default(autoincrement())
  studentRm Int      @map("aluno_rm")
  date      DateTime @map("dia") @db.Date
  position  Int      @map("ordem")
  student   Student  @relation(fields: [studentRm], references: [rm], onDelete: Cascade)
  lessons   Lesson[]

  @@unique([studentRm, date])
  @@map("dias_agenda")
}

model Lesson {
  id            Int         @id @default(autoincrement())
  scheduleDayId Int         @map("dia_agenda_id")
  time          String      @map("horario")
  subject       String      @map("disciplina")
  position      Int         @map("ordem")
  scheduleDay   ScheduleDay @relation(fields: [scheduleDayId], references: [id], onDelete: Cascade)

  @@unique([scheduleDayId, position])
  @@map("aulas")
}

model ReportCard {
  id        Int     @id @default(autoincrement())
  studentRm Int     @map("aluno_rm")
  year      String  @map("ano") @db.Char(4)
  className String  @map("turma")
  position  Int     @map("ordem")
  student   Student @relation(fields: [studentRm], references: [rm], onDelete: Cascade)
  terms     Term[]

  @@unique([studentRm, year])
  @@map("boletins")
}

model Term {
  id           Int            @id @default(autoincrement())
  reportCardId Int            @map("boletim_id")
  number       Int            @map("trimestre")
  reportCard   ReportCard     @relation(fields: [reportCardId], references: [id], onDelete: Cascade)
  grades       SubjectGrade[]

  @@unique([reportCardId, number])
  @@map("trimestres")
}

model SubjectGrade {
  id       Int      @id @default(autoincrement())
  termId   Int      @map("trimestre_id")
  subject  String   @map("disciplina")
  grade    Decimal? @map("nota") @db.Decimal(4, 1)
  absences Int?     @map("faltas")
  position Int      @map("ordem")
  term     Term     @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@unique([termId, position])
  @@map("notas")
}

model Session {
  id            String         @id @default(uuid()) @db.Uuid
  guardianId    Int            @map("responsavel_id")
  createdAt     DateTime       @default(now()) @map("criada_em")
  lastUsedAt    DateTime       @default(now()) @map("ultimo_uso_em")
  revokedAt     DateTime?      @map("revogada_em")
  revokedReason String?        @map("motivo_revogacao")
  guardian      Guardian       @relation(fields: [guardianId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]

  @@index([guardianId])
  @@map("sessoes")
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  sessionId  String    @map("sessao_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash") @db.Char(64)
  expiresAt  DateTime  @map("expira_em")
  createdAt  DateTime  @default(now()) @map("criado_em")
  usedAt     DateTime? @map("usado_em")
  replacedBy String?   @map("substituido_por") @db.Uuid
  session    Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("refresh_tokens")
}
```

`motivo_revogacao` aceita `logout` ou `reuso`. A sessão revogada invalida todos os refresh e access tokens dela (spec 04 §3).

A primeira migration inclui, em SQL, `ALTER TABLE … ENABLE ROW LEVEL SECURITY` para todas as tabelas, sem políticas (D-20). O Prisma conecta como dono das tabelas e não é afetado; qualquer acesso pela Data API do Supabase fica bloqueado.

## 3. Regras

1. **Ordem:** toda consulta do agregado ordena por `ordem`. Dias da agenda: `ordem` (que no JSON coincide com a data crescente). Trimestres: `trimestre`.
2. **`null`:** `nota` e `faltas` nulos chegam nulos à view. `Decimal` vira `number` na view (ex.: 9.5).
3. **`dia`:** guardado como `DATE` e devolvido como `AAAA-MM-DD`, sem hora nem fuso.
4. **`ano`:** texto de 4 caracteres, devolvido como string.
5. **CPF:** só dígitos (`CHAR(11)`), único. Nunca é devolvido.
6. **Id do responsável:** igual ao do JSON. O seed insere o id explicitamente, porque o app guarda o `guardianId` na sessão e o compara com o `/me`.
7. **Refresh tokens:** guardar só o hash (SHA-256 em hexadecimal) e nunca o valor. Sessões revogadas e tokens expirados há mais de 30 dias podem ser limpos por uma rotina futura (fora do escopo).
8. **Ambientes (D-04, D-13):**
   - tudo no Supabase, com as mesmas migrations;
   - desenvolvimento no schema `fiap_school`;
   - testes de integração no schema `fiap_school_test`;
   - produção a definir na T11 (outro projeto ou outro schema).

## 4. Seed (D-12)

Detalhado em `features/seed.md`. Em resumo:
- lê o arquivo de `SEED_SOURCE_PATH`;
- valida o formato com zod;
- grava as senhas com bcrypt;
- regrava tudo numa transação, preservando a ordem;
- nunca registra dados em log.
