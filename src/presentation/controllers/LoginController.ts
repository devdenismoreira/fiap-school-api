import type { Request, Response } from 'express';
import { InvalidCredentialsError } from '@/domain/errors/DomainErrors';
import type { Logger } from '@/domain/ports/Logger';
import type { Login } from '@/domain/usecases/login';
import type { LoginBody } from '@/presentation/schemas/authSchemas';
import { loginView } from '@/presentation/views/tokensView';

export type CpfFingerprint = (cpf: string) => string;

export class LoginController {
  constructor(
    private readonly login: Login,
    private readonly logger: Logger,
    private readonly cpfFingerprint: CpfFingerprint,
  ) {}

  readonly handle = async (request: Request, response: Response) => {
    const { cpf, senha } = request.body as LoginBody;
    const cpfHmac = this.cpfFingerprint(cpf);
    try {
      const result = await this.login({ cpf, password: senha });
      this.logger.info({ evento: 'login_sucesso', cpfHmac }, 'Login realizado');
      response.status(200).json(loginView(result));
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        this.logger.info({ evento: 'login_falha', cpfHmac }, 'Falha de login');
      }
      throw error;
    }
  };
}
