import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { RequestHandler, Response } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

type ResponseObject = Readonly<{
  $ref?: string;
  content?: Record<string, unknown>;
}>;

type OpenApiDocument = Readonly<{
  paths: Record<
    string,
    Record<string, { responses: Record<string, ResponseObject> }>
  >;
  components: Readonly<{ responses: Record<string, ResponseObject> }>;
}>;

const SPEC_ID = 'openapi.yaml';
const FORBIDDEN_KEYS = new Set(['cpf', 'email', 'senha', 'passwordHash']);
const ERROR_SCHEMA = `${SPEC_ID}#/components/schemas/Erro`;

const document = parse(
  readFileSync(resolve(__dirname, '..', '..', 'openapi.yaml'), 'utf8'),
) as OpenApiDocument;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(document, SPEC_ID);

const routes = Object.keys(document.paths).map(template => ({
  template,
  pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
}));

const validators = new Map<string, ValidateFunction>();
const violations: string[] = [];
let checkedResponses = 0;

function pointer(...segments: readonly string[]): string {
  return segments
    .map(segment => segment.replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/');
}

function validatorFor(ref: string): ValidateFunction {
  const cached = validators.get(ref);
  if (cached) {
    return cached;
  }
  const validate = ajv.compile({ $ref: ref });
  validators.set(ref, validate);
  return validate;
}

function forbiddenKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      forbiddenKeys(item, `${path}[${index}]`),
    );
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, item]) => [
    ...(FORBIDDEN_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenKeys(item, `${path}.${key}`),
  ]);
}

function documentedSchema(
  template: string,
  method: string,
  status: string,
): { documented: boolean; schemaRef?: string } {
  const response = document.paths[template]?.[method]?.responses[status];
  if (!response) {
    return { documented: false };
  }
  if (response.$ref) {
    const name = response.$ref.split('/').pop() ?? '';
    const target = document.components.responses[name];
    return {
      documented: target !== undefined,
      ...(target?.content
        ? {
            schemaRef: `${SPEC_ID}#/${pointer('components', 'responses', name, 'content', 'application/json', 'schema')}`,
          }
        : {}),
    };
  }
  return {
    documented: true,
    ...(response.content
      ? {
          schemaRef: `${SPEC_ID}#/${pointer('paths', template, method, 'responses', status, 'content', 'application/json', 'schema')}`,
        }
      : {}),
  };
}

function validateBody(label: string, ref: string, body: unknown): void {
  const validate = validatorFor(ref);
  if (!validate(body)) {
    violations.push(`${label}: ${ajv.errorsText(validate.errors)}`);
  }
}

export function checkResponse(
  method: string,
  path: string,
  status: number,
  body: { sent: false } | { sent: true; value: unknown },
): void {
  checkedResponses += 1;
  const label = `${method.toUpperCase()} ${path} → ${status}`;
  if (body.sent) {
    const exposed = forbiddenKeys(body.value);
    if (exposed.length > 0) {
      violations.push(`${label}: expõe ${exposed.join(', ')}`);
    }
  }
  const route = routes.find(item => item.pattern.test(path));
  const operation = route && document.paths[route.template]?.[method];
  if (!route || !operation) {
    if (body.sent) {
      validateBody(label, ERROR_SCHEMA, body.value);
    }
    return;
  }
  const { documented, schemaRef } = documentedSchema(
    route.template,
    method,
    String(status),
  );
  if (!documented) {
    violations.push(`${label}: status não documentado no openapi.yaml`);
    return;
  }
  if (schemaRef && !body.sent) {
    violations.push(`${label}: o contrato espera corpo JSON`);
  } else if (!schemaRef && body.sent) {
    violations.push(`${label}: o contrato não prevê corpo`);
  } else if (schemaRef && body.sent) {
    validateBody(label, schemaRef, body.value);
  }
}

export function contractInspector(): RequestHandler {
  return (request, response, next) => {
    if (request.method === 'OPTIONS' || request.path.startsWith('/docs')) {
      next();
      return;
    }
    const method = request.method.toLowerCase();
    const path = request.path;
    let body: { sent: false } | { sent: true; value: unknown } = {
      sent: false,
    };
    const originalJson = response.json.bind(response);
    response.json = ((value: unknown) => {
      body = { sent: true, value };
      return originalJson(value);
    }) as Response['json'];
    response.on('finish', () => {
      checkResponse(method, path, response.statusCode, body);
    });
    next();
  };
}

export function contractViolations(): readonly string[] {
  return [...violations];
}

export function contractCheckedResponses(): number {
  return checkedResponses;
}

export function resetContractChecks(): void {
  violations.length = 0;
  checkedResponses = 0;
}
