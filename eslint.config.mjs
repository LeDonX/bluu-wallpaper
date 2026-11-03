import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', 'dist/**', 'release/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    },
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      // 05 §3：禁止 any，外部数据用 unknown + zod
      '@typescript-eslint/no-explicit-any': 'error',
      // 05 §3：导入类型必须用 import type
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // 05 §8：渲染层禁止 console.log，统一经 IPC 写入主进程日志
      'no-console': 'error'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['scripts/**/*.{js,cjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs'
    }
  },
  prettier
);
