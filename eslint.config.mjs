import nx from '@nx/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import perfectionist from 'eslint-plugin-perfectionist';
import preferArrowPlugin from 'eslint-plugin-prefer-arrow';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
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

  // Ignored paths
  {
    ignores: ['**/dist', '**/node_modules', '**/coverage'],
  },

  // Rules for all JS/TS/JSX/TSX files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@nx': nx,
      jsdoc,
      'prefer-arrow': preferArrowPlugin,
      prettier: eslintPluginPrettier,
      'unused-imports': unusedImports,
    },
    rules: {
      // Nx-specific rules
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            "@nestkit-x/core/**"
          ],
          depConstraints: [
            {
              onlyDependOnLibsWithTags: ['*'],
              sourceTag: '*',
            },
          ],
          enforceBuildableLibDependency: true,
        },
      ],

      'array-bracket-spacing': ['error', 'never'],

      'arrow-spacing': 'error',
      // Naming conventions
      camelcase: ['error', { ignoreDestructuring: false, properties: 'never' }],
      'comma-dangle': ['error', 'always-multiline'],
      complexity: ['warn', 10],
      // Function structure rules
      'function-call-argument-newline': ['error', 'consistent'],
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'error',
      'jsdoc/check-line-alignment': ['error', 'never'],
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-property-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'off',
      'jsdoc/no-undefined-types': 'off',
      // JSDoc rules (adapted for NestJS-style code)
      'jsdoc/require-description': 'error',
      'jsdoc/require-description-complete-sentence': 'error',

      'jsdoc/require-example': [
        'warn',
        {
          contexts: ['ClassDeclaration', 'MethodDefinition[kind="method"]'],
        },
      ],
      'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
      'jsdoc/require-jsdoc': [
        'off', // enable later
        {
          contexts: ['PropertyDefinition', 'TSPropertySignature'],
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: true,
          },
        },
      ],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-throws': 'error',

      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],

      'lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', next: 'method', prev: 'method' },
            { blankLine: 'always', next: 'method', prev: 'field' },
          ],
        },
        {
          exceptAfterSingleLine: true,
        },
      ],
      'max-depth': ['warn', 4],

      'max-params': ['warn', 4],
      'no-alert': 'error',
      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
      'no-useless-constructor': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'object-curly-spacing': ['error', 'always'],
      // Code formatting & padding
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', next: '*', prev: ['const', 'let', 'var'] },
        { blankLine: 'any', next: ['const', 'let', 'var'], prev: ['const', 'let', 'var'] },
        { blankLine: 'always', next: '*', prev: 'import' },
        { blankLine: 'any', next: 'import', prev: 'import' },
        { blankLine: 'always', next: 'function', prev: '*' },
        { blankLine: 'always', next: 'class', prev: '*' },
        { blankLine: 'always', next: 'export', prev: '*' },
        { blankLine: 'always', next: '*', prev: 'block-like' },
      ],
      // Replaced import sorting with perfectionist
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
            'unknown',
          ],
          order: 'asc',
          type: 'natural',
        },
      ],

      'prefer-arrow-callback': 'error',

      // Prefer arrow functions
      'prefer-arrow/prefer-arrow-functions': [
        'error',
        {
          classPropertiesAllowed: false,
          disallowPrototype: true,
          singleReturnOnly: false,
        },
      ],
      'prefer-const': 'error',
      'prefer-template': 'error',
      // Prettier integration
      'prettier/prettier': ['error'],
      'template-curly-spacing': ['error', 'never'],
    },
  },

  // Rules specifically for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.base.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowConciseArrowFunctionExpressionsStartingWithVoid: false,
          allowDirectConstAssertionInArrowFunctions: true,
          allowExpressions: false,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: {
            accessors: 'explicit',
            constructors: 'explicit',
            methods: 'explicit',
            parameterProperties: 'off',
            properties: 'explicit',
          },
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-static-field',
            'protected-static-field',
            'private-static-field',
            'public-instance-field',
            'protected-instance-field',
            'private-instance-field',
            'public-abstract-field',
            'protected-abstract-field',
            'public-constructor',
            'protected-constructor',
            'private-constructor',
            'public-static-method',
            'protected-static-method',
            'private-static-method',
            'public-instance-method',
            'protected-instance-method',
            'private-instance-method',
            'public-abstract-method',
            'protected-abstract-method',
          ],
        },
      ],
      '@typescript-eslint/method-signature-style': ['error', 'method'],
      '@typescript-eslint/naming-convention': [
        'error',
        { format: ['camelCase'], selector: 'variableLike' },
        { format: ['camelCase'], selector: 'memberLike' },
        { format: ['PascalCase'], selector: 'typeLike' },
        { format: ['PascalCase'], selector: 'enumMember' },
        { format: ['PascalCase'], prefix: ['I'], selector: 'interface' },
        { format: ['PascalCase'], selector: 'typeAlias' },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      camelcase: 'off',
      
      // Disable base rules that conflict with TS equivalents
      'comma-dangle': 'off',

      'jsdoc/no-types': 'error',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',

      'no-duplicate-imports': 'off',
      'no-unused-vars': 'off',
      'no-useless-constructor': 'off',
      semi: 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];