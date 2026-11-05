import {
  checkResponse,
  contractCheckedResponses,
  contractViolations,
  resetContractChecks,
} from './contractChecker';

const responsavel = {
  id: 1,
  primeiroNome: 'Ana',
  sobrenome: 'Exemplo',
  alunos: [
    {
      rm: 900001,
      turma: '7EF',
      periodo: 'Matutino',
      primeiroNome: 'Bia',
      sobrenome: 'Exemplo',
      agenda: [{ dia: '2025-03-16', aulas: [] }],
      boletim: [
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
    },
  ],
};

beforeEach(() => resetContractChecks());

describe('verificação das respostas contra o openapi.yaml', () => {
  it('aceita uma resposta que segue o contrato', () => {
    checkResponse('get', '/v1/me', 200, { sent: true, value: responsavel });
    checkResponse('post', '/v1/auth/logout', 204, { sent: false });
    checkResponse('get', '/v1/alunos/900001/agenda', 404, {
      sent: true,
      value: {
        erro: {
          codigo: 'ALUNO_NAO_ENCONTRADO',
          mensagem: 'Aluno não encontrado.',
        },
      },
    });

    expect(contractViolations()).toEqual([]);
    expect(contractCheckedResponses()).toBe(3);
  });

  it('acusa campo a mais, como cpf no responsável (teste de exposição)', () => {
    checkResponse('get', '/v1/me', 200, {
      sent: true,
      value: { ...responsavel, cpf: '00000000000' },
    });

    expect(contractViolations().join()).toContain('expõe .cpf');
  });

  it('acusa nota trocada por string e chave nula omitida', () => {
    const [aluno] = responsavel.alunos;
    const broken = {
      ...responsavel,
      alunos: [
        {
          ...aluno,
          boletim: [
            {
              ano: '2025',
              turma: '7EF',
              trimestres: [
                {
                  trimestre: 1,
                  disciplinas: [{ nome: 'Matemática', nota: '-' }],
                },
              ],
            },
          ],
        },
      ],
    };

    checkResponse('get', '/v1/me', 200, { sent: true, value: broken });

    expect(contractViolations()).toHaveLength(1);
  });

  it('acusa status não documentado e corpo onde o contrato não prevê', () => {
    checkResponse('get', '/v1/me', 418, { sent: false });
    checkResponse('post', '/v1/auth/logout', 204, {
      sent: true,
      value: { ok: true },
    });

    expect(contractViolations()).toHaveLength(2);
  });

  it('em rota fora do contrato, exige o formato de erro', () => {
    checkResponse('get', '/v1/nao-existe', 404, {
      sent: true,
      value: {
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Recurso não encontrado.' },
      },
    });
    checkResponse('get', '/v1/nao-existe', 404, {
      sent: true,
      value: { mensagem: 'fora do formato' },
    });

    expect(contractViolations()).toHaveLength(1);
  });
});
