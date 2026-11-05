import { studentReportCardsView, studentScheduleView } from './studentViews';

describe('studentScheduleView', () => {
  it('embrulha a agenda na chave agenda, com os dias sem aula', () => {
    expect(
      studentScheduleView([
        { date: '2025-03-16', lessons: [] },
        {
          date: '2025-03-17',
          lessons: [{ time: '07:30 - 08:15', subject: 'Matemática' }],
        },
      ]),
    ).toStrictEqual({
      agenda: [
        { dia: '2025-03-16', aulas: [] },
        {
          dia: '2025-03-17',
          aulas: [{ horario: '07:30 - 08:15', disciplina: 'Matemática' }],
        },
      ],
    });
  });
});

describe('studentReportCardsView', () => {
  it('embrulha os boletins na chave boletins, mantendo os null', () => {
    expect(
      studentReportCardsView([
        {
          year: '2025',
          className: '7EF',
          terms: [
            {
              number: 1,
              grades: [{ subject: 'Matemática', grade: null, absences: null }],
            },
          ],
        },
      ]),
    ).toStrictEqual({
      boletins: [
        {
          ano: '2025',
          turma: '7EF',
          trimestres: [
            {
              trimestre: 1,
              disciplinas: [{ nome: 'Matemática', nota: null, faltas: null }],
            },
          ],
        },
      ],
    });
  });
});
