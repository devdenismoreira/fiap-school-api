import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const SPEC_ROUTE = '/docs/openapi.yaml';

export function docsRoutes(openapiPath: string): Router {
  const router = Router();
  router.get(SPEC_ROUTE, (_request, response) => {
    response.type('application/yaml').sendFile(openapiPath);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'FIAP School API',
      swaggerOptions: { url: SPEC_ROUTE },
    }),
  );
  return router;
}
