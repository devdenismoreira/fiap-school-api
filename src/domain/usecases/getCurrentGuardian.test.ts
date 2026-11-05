import type { Guardian } from '@/domain/entities/Guardian';
import { InvalidAccessTokenError } from '@/domain/errors/DomainErrors';
import { createGetCurrentGuardian } from './getCurrentGuardian';

const guardian: Guardian = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Exemplo',
  students: [],
};

function setup() {
  const findById = jest.fn((id: number) =>
    Promise.resolve(id === 7 ? guardian : null),
  );
  const getCurrentGuardian = createGetCurrentGuardian({
    findById,
    findByCpf: jest.fn(),
    findLinkedStudent: jest.fn(),
  });
  return { getCurrentGuardian, findById };
}

describe('getCurrentGuardian', () => {
  it('devolve o responsável do id do token', async () => {
    const { getCurrentGuardian, findById } = setup();

    await expect(getCurrentGuardian(7)).resolves.toBe(guardian);
    expect(findById).toHaveBeenCalledWith(7);
  });

  it('recusa como token inválido quando o responsável não existe mais', async () => {
    const { getCurrentGuardian } = setup();

    await expect(getCurrentGuardian(99)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
