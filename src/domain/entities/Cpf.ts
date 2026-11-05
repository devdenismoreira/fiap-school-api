const CPF_PATTERN = /^\d{11}$/;
const REPEATED_DIGITS = /^(\d)\1{10}$/;

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  return ((sum * 10) % 11) % 10;
}

export function isValidCpf(digits: string): boolean {
  if (!CPF_PATTERN.test(digits) || REPEATED_DIGITS.test(digits)) {
    return false;
  }
  return (
    checkDigit(digits, 9) === Number(digits[9]) &&
    checkDigit(digits, 10) === Number(digits[10])
  );
}
