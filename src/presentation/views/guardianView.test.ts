import type { Guardian } from '@/domain/entities/Guardian';
import { guardianView } from './guardianView';
import { reportCardsView } from './reportCardsView';
import { scheduleView } from './scheduleView';

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
      schedule: [
        { date: '2025-03-16', lessons: [] },
        {
          date: '2025-03-17',
          lessons: [
            { time: '07:30 - 08:15', subject: 'Matemática' },
            { time: '08:15 - 09:00', subject: 'Ciências' },
          ],
        },
      ],
      reportCards: [
        {
          year: '2025',
          className: '7EF',
          terms: [
            {
              number: 1,
              grades: [{ subject: 'Matemática', grade: 9.5, absences: 0 }],
            },
            {
              number: 2,
              grades: [{ subject: 'Matemática', grade: null, absences: null }],
            },
          ],
        },
      ],
    },
    {
      rm: 900002,
      className: '3EM',
      shift: 'Vespertino',
      firstName: 'Caio',
      lastName: 'Exemplo',
      schedule: [],
      reportCards: [],
    },
  ],
};

describe('guardianView', () => {
  it('monta o JSON do contrato campo a campo, na ordem e com os null', () => {
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
          agenda: [
            { dia: '2025-03-16', aulas: [] },
            {
              dia: '2025-03-17',
              aulas: [
                { horario: '07:30 - 08:15', disciplina: 'Matemática' },
                { horario: '08:15 - 09:00', disciplina: 'Ciências' },
              ],
            },
          ],
          boletim: [
            {
              ano: '2025',
              turma: '7EF',
              trimestres: [
                {
                  trimestre: 1,
                  disciplinas: [{ nome: 'Matemática', nota: 9.5, faltas: 0 }],
                },
                {
                  trimestre: 2,
                  disciplinas: [
                    { nome: 'Matemática', nota: null, faltas: null },
                  ],
                },
              ],
            },
          ],
        },
        {
          rm: 900002,
          turma: '3EM',
          periodo: 'Vespertino',
          primeiroNome: 'Caio',
          sobrenome: 'Exemplo',
          agenda: [],
          boletim: [],
        },
      ],
    });
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

  it('mantém a chave nota e faltas mesmo quando são null', () => {
    const [disciplina] =
      guardianView(guardian).alunos[0]?.boletim[0]?.trimestres[1]
        ?.disciplinas ?? [];

    expect(disciplina).toHaveProperty('nota', null);
    expect(disciplina).toHaveProperty('faltas', null);
  });
});

describe('scheduleView e reportCardsView', () => {
  it('são as mesmas partes usadas no guardianView', () => {
    const [student] = guardian.students;
    const [studentJson] = guardianView(guardian).alunos;

    expect(scheduleView(student!.schedule)).toStrictEqual(studentJson!.agenda);
    expect(reportCardsView(student!.reportCards)).toStrictEqual(
      studentJson!.boletim,
    );
  });
});
