import request from 'supertest';
import { loadEnv } from '@/main/config/env';
import type { Dependencies } from '@/main/dependencies';
import { createDependencies } from '../support/checkedDependencies';
import { contractCheckedResponses } from '../support/contractChecker';
import {
  loadSourceForTests,
  withoutCredentials,
} from '../support/seedSourceForTests';

const source = loadSourceForTests();

describe('paridade do contrato com o JSON do app', () => {
  let api: Dependencies;
  beforeAll(async () => {
    api = await createDependencies(loadEnv(process.env));
  });
  afterAll(() => api.close());

  it.each(source.map(guardian => guardian.id))(
    'responsável %i: login → GET /v1/me é idêntico ao registro da fonte sem cpf, email e senha',
    async id => {
      const guardian = source.find(item => item.id === id)!;
      const login = await request(api.app)
        .post('/v1/auth/login')
        .send({ cpf: guardian.cpf, senha: guardian.senha })
        .expect(200);
      const { accessToken } = login.body as { accessToken: string };

      const me = await request(api.app)
        .get('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(me.body).toStrictEqual(withoutCredentials(guardian));
    },
  );

  it('as respostas desta suíte passaram pela verificação do openapi.yaml', () => {
    expect(contractCheckedResponses()).toBeGreaterThanOrEqual(
      source.length * 2,
    );
  });
});
