export type ErrorView = Readonly<{
  erro: Readonly<{ codigo: string; mensagem: string }>;
}>;

export function errorView(codigo: string, mensagem: string): ErrorView {
  return { erro: { codigo, mensagem } };
}
