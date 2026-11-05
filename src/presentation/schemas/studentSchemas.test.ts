import { studentParamsSchema } from './studentSchemas';

describe('studentParamsSchema', () => {
  it.each([
    ['1', 1],
    ['12345', 12345],
    ['999999999', 999_999_999],
  ])('aceita o RM %s e o converte em número', (rm, expected) => {
    expect(studentParamsSchema.parse({ rm })).toEqual({ rm: expected });
  });

  it.each([
    ['não numérico', 'abc'],
    ['negativo', '-1'],
    ['zero', '0'],
    ['com zero à esquerda', '012345'],
    ['decimal', '123.5'],
    ['em notação científica', '1e3'],
    ['com mais de 9 dígitos', '1000000000'],
    ['com espaço', ' 123'],
    ['vazio', ''],
  ])('recusa RM %s', (_caso, rm) => {
    expect(studentParamsSchema.safeParse({ rm }).success).toBe(false);
  });
});
