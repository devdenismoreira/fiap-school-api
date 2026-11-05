import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadSeedSource,
  parseSeedSource,
  SeedError,
  uniqueStudents,
  type SeedSource,
} from './seedSource';

function validSource(): SeedSource {
  return [
    {
      id: 1,
      cpf: '00000000001',
      email: 'ficticio@exemplo.com',
      senha: 'segredo-ficticio',
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
                  disciplinas: [{ nome: 'Matemática', nota: null, faltas: 2 }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(SeedError);
    return (error as Error).message;
  }
  throw new Error('Era esperado um erro');
}

describe('parseSeedSource', () => {
  it('aceita o formato do JSON do app', () => {
    expect(parseSeedSource(JSON.stringify(validSource()))).toEqual(
      validSource(),
    );
  });

  it('recusa chave inesperada, sem mostrar valores', () => {
    const source = validSource() as unknown as Record<string, unknown>[];
    source[0] = { ...source[0], telefone: '11999999999' };

    const message = messageOf(() => parseSeedSource(JSON.stringify(source)));

    expect(message).toContain('formato inesperado');
    expect(message).not.toContain('11999999999');
    expect(message).not.toContain('segredo-ficticio');
  });

  it.each([
    ['CPF com máscara', { cpf: '000.000.000-01' }],
    ['id negativo', { id: -1 }],
    ['senha vazia', { senha: '' }],
  ])('recusa %s', (_caso, override) => {
    const [guardian] = validSource();
    const message = messageOf(() =>
      parseSeedSource(JSON.stringify([{ ...guardian, ...override }])),
    );

    expect(message).toContain('formato inesperado');
    expect(message).not.toContain('00000000001');
  });

  it('recusa dia fora do formato AAAA-MM-DD', () => {
    const source = validSource();
    const json = JSON.stringify(source).replace('2025-03-16', '16/03/2025');

    expect(messageOf(() => parseSeedSource(json))).toContain('agenda');
  });

  it('recusa texto que não é JSON', () => {
    expect(messageOf(() => parseSeedSource('{ isso não é json'))).toBe(
      'O arquivo de origem do seed não é um JSON válido.',
    );
  });
});

describe('loadSeedSource', () => {
  it('falha com mensagem clara quando o arquivo não existe', () => {
    expect(
      messageOf(() => loadSeedSource('/caminho/que/nao/existe.json')),
    ).toContain('não encontrado em SEED_SOURCE_PATH');
  });

  it('lê e valida o arquivo do caminho informado', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seed-'));
    const path = join(directory, 'responsaveis.json');
    writeFileSync(path, JSON.stringify(validSource()));

    expect(loadSeedSource(path)).toEqual(validSource());
  });
});

describe('uniqueStudents', () => {
  it('une o aluno que aparece em dois responsáveis com os mesmos dados', () => {
    const [first] = validSource();
    const second = { ...first!, id: 2, cpf: '00000000002' };

    expect(uniqueStudents([first!, second])).toHaveLength(1);
  });

  it('recusa o mesmo RM com dados diferentes, sem mostrar o RM', () => {
    const [first] = validSource();
    const second = {
      ...first!,
      id: 2,
      alunos: [{ ...first!.alunos[0]!, turma: '8EF' }],
    };

    const message = messageOf(() => uniqueStudents([first!, second]));

    expect(message).toContain('dados diferentes');
    expect(message).not.toContain('900001');
  });
});
