export default {
  coverageDirectory: '../../coverage/apps/nestkit-x-app',
  displayName: 'nestkit-x-app',
  moduleFileExtensions: ['ts', 'js', 'html'],
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
