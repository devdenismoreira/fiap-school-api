import type { Request, Response } from 'express';
import { errorView } from '@/presentation/views/errorView';

export function notFoundHandler(_request: Request, response: Response): void {
  response
    .status(404)
    .json(errorView('NAO_ENCONTRADO', 'Recurso não encontrado.'));
}
