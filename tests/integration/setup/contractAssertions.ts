import { contractViolations } from '../../support/contractChecker';

afterAll(() => {
  expect(contractViolations()).toEqual([]);
});
