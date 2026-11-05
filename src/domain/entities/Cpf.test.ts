import { isValidCpf } from './Cpf';

describe('isValidCpf', () => {
  it.each(['86686328685', '06127842581', '57915054937'])(
    'aceita CPF com dígitos verificadores corretos (%s, fictício)',
    cpf => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it.each([
    ['primeiro dígito verificador errado', '86686328695'],
    ['segundo dígito verificador errado', '86686328684'],
    ['todos os dígitos iguais', '11111111111'],
    ['zeros', '00000000000'],
    ['10 dígitos', '8668632868'],
    ['12 dígitos', '866863286850'],
    ['com máscara', '866.863.286-85'],
    ['com letras', '8668632868a'],
    ['vazio', ''],
  ])('recusa %s', (_caso, cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});
