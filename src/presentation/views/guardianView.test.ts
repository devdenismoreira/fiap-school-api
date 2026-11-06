import type { Guardian } from '@/domain/entities/Guardian';
import { guardianView } from './guardianView';

const guardian: Guardian = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Exemplo',
  students: [
    {
      rm: 900001,
      className: '7EF',
      shift: 'Matutino',
      firstName: 'Bia',
      lastName: 'Exemplo',
    },
    {
      rm: 900002,
      className: '3EM',
      shift: 'Vespertino',
      firstName: 'Caio',
      lastName: 'Exemplo',
    },
  ],
};

describe('guardianView', () => {
  it('monta o JSON do contrato campo a campo e na ordem dos alunos', () => {
    expect(guardianView(guardian)).toStrictEqual({
      id: 7,
      primeiroNome: 'Ana',
      sobrenome: 'Exemplo',
      alunos: [
        {
          rm: 900001,
          turma: '7EF',
          periodo: 'Matutino',
          primeiroNome: 'Bia',
          sobrenome: 'Exemplo',
        },
        {
          rm: 900002,
          turma: '3EM',
          periodo: 'Vespertino',
          primeiroNome: 'Caio',
          sobrenome: 'Exemplo',
        },
      ],
    });
  });

  it('não traz agenda nem boletim: eles vêm só das rotas de alunos', () => {
    const withRecords = {
      ...guardian,
      students: guardian.students.map(student => ({
        ...student,
        schedule: [{ date: '2025-03-17', lessons: [] }],
        reportCards: [{ year: '2025', className: '7EF', terms: [] }],
      })),
    } as Guardian;

    const json = JSON.stringify(guardianView(withRecords));

    for (const forbidden of ['agenda', 'boletim', 'schedule', 'reportCards']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('não expõe cpf, email, senha, hash nem campos internos', () => {
    const entityWithExtras = {
      ...guardian,
      cpf: '00000000000',
      email: 'ficticio@exemplo.com',
      passwordHash: '$2b$12$hashficticio',
      position: 0,
    } as Guardian;

    const json = JSON.stringify(guardianView(entityWithExtras));

    for (const forbidden of [
      'cpf',
      'email',
      'senha',
      'passwordHash',
      'position',
      'ordem',
      '00000000000',
      'ficticio@exemplo.com',
      'hashficticio',
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
