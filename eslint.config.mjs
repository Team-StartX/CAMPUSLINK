import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) });
export default [
  { ignores: ['.next/**', 'node_modules/**', '.npm-cache/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] } },
];
