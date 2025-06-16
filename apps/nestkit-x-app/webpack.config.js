/* eslint-disable @typescript-eslint/no-require-imports */
const { join } = require('path');

const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/nestkit-x-app'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      assets: ['./src/assets'],
      compiler: 'tsc',
      generatePackageJson: true,
      main: './src/main.ts',
      optimization: false,
      outputHashing: 'none',
      target: 'node',
      tsConfig: './tsconfig.app.json',
    }),
  ],
};
