const path = require('path');
const { composePlugins, withNx } = require('@nx/webpack');
const WebpackBar = require('webpackbar');

module.exports = composePlugins(
  withNx({
    target: 'node',
    compiler: 'tsc',

    // Critically important for Typia/Nestia transformers,
    // as they require full access to AST and type checking.
    skipTypeChecking: false,
  }),
  (config) => {
    // Enable filesystem caching to speed up subsequent builds
    config.cache = { type: 'filesystem' };

    // Ensure module.rules structure exists
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    // 1. Cleanup: Remove any default Nx rules for .ts/.tsx files.
    // This prevents conflicts if Nx tries to use swc-loader or babel-loader.
    config.module.rules = config.module.rules.filter((rule) => {
      return !(rule && rule.test && rule.test.toString().includes('ts'));
    });

    // 2. Injection: Add our strict ts-loader rule.
    // We use ts-patch (via pnpm prepare), so ts-loader will automatically
    // pick up plugins (Typia, Nestia) from tsconfig.app.json.
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.app.json'),
            // Must be false: transformers do not work in transpileOnly mode
            transpileOnly: false,
            // Optional: speeds up builds when there are many files
            experimentalWatchApi: true,
          },
        },
      ],
    });

    // 3. UI/UX: Add progress bar
    config.plugins.push(
      new WebpackBar({
        name: 'example-app',
        color: 'green',
        reporters: ['fancy'],
      }),
    );

    // 4. DX: Plugin to clear console on reload (watch mode)
    config.plugins.push({
      apply: (compiler) => {
        compiler.hooks.watchRun.tap('ClearScreen', () => {
          process.stdout.write('\x1Bc');
        });
      },
    });

    return config;
  },
);
