import docusaurusLint from '@docusaurus/eslint-plugin';
import nx from '@nx/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import perfectionist from 'eslint-plugin-perfectionist';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default [
  // Base configurations from Nx and TypeScript
  eslintConfigPrettier,
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended-typescript'],
  perfectionist.configs['recommended-natural'],
  sonarjs.configs.recommended,

  // Docusaurus configuration (manually converted to flat config)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@docusaurus': docusaurusLint,
    },
    rules: {
      // Всі правила з docusaurusLint.configs.all
      ...docusaurusLint.configs.recommended?.rules,
      '@docusaurus/no-html-links': 'warn',
      '@docusaurus/no-untranslated-text': 'warn',
      '@docusaurus/prefer-docusaurus-heading': 'warn',
      '@docusaurus/string-literal-i18n-messages': 'warn',
    },
  },

  // Ignored paths
  {
    ignores: ['**/dist', '**/node_modules', '**/coverage', '**/docs/**', '**/.docusaurus/**'],
  },
];
