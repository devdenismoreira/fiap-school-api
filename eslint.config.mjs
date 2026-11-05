import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const layer = name => [
  `@/${name}`,
  `@/${name}/**`,
  `**/${name}`,
  `**/${name}/**`,
];

const restrictImports = (groups, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: groups, message }] },
  ],
});

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'src/infra/database/generated']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: restrictImports(
      [
        'express',
        'express/**',
        '@prisma/**',
        'pg',
        'jose',
        'bcrypt',
        'pino',
        'pino-http',
        'helmet',
        'cors',
        'express-rate-limit',
        ...layer('infra'),
        ...layer('presentation'),
        ...layer('main'),
      ],
      'O domínio não depende de framework, banco, bibliotecas de segurança nem de outras camadas (CLAUDE.md §5).',
    ),
  },
  {
    files: ['src/presentation/**/*.ts'],
    rules: restrictImports(
      ['@prisma/**', 'pg', ...layer('infra'), ...layer('main')],
      'A apresentação usa casos de uso e portas do domínio, nunca o Prisma nem a infra (CLAUDE.md §5).',
    ),
  },
  {
    files: ['src/infra/**/*.ts'],
    rules: restrictImports(
      ['express', 'express/**', ...layer('presentation'), ...layer('main')],
      'A infra implementa as portas do domínio e não conhece a camada HTTP nem o composition root (CLAUDE.md §5).',
    ),
  },
  prettier,
);
