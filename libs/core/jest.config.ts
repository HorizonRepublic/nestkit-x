export default {
  coverageDirectory: '../../coverage/libs/core',
  displayName: 'core',
  moduleFileExtensions: ['ts', 'js', 'html'],
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
