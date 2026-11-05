import type { RequestHandler } from 'express';
import type { z } from 'zod';

export class InvalidRequestError extends Error {
  override readonly name = 'InvalidRequestError';

  constructor() {
    super('Dados inválidos.');
  }
}

export type RequestSchemas = Readonly<{
  body?: z.ZodType;
  params?: z.ZodType;
}>;

export function validate(schemas: RequestSchemas): RequestHandler {
  return (request, response, next) => {
    if (schemas.body) {
      const body = schemas.body.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      request.body = body.data;
    }
    if (schemas.params) {
      const params = schemas.params.safeParse(request.params);
      if (!params.success) {
        throw new InvalidRequestError();
      }
      response.locals.params = params.data;
    }
    next();
  };
}
