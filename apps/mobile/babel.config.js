const path = require('path');

// Resolve worklets Babel plugin from the installed 0.12.x package (avoid stale 0.11.x).
const workletsPlugin = require.resolve('react-native-worklets/plugin', {
  paths: [__dirname, path.resolve(__dirname, '../..')],
});

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
        },
        extensions: [
          '.ios.js',
          '.android.js',
          '.js',
          '.ts',
          '.tsx',
          '.json',
          '.png',
          '.jpg',
          '.jpeg',
          '.webp',
          '.mp4',
        ],
      },
    ],
    // Must be last. Reanimated re-exports this plugin; pin explicitly for pnpm monorepo.
    workletsPlugin,
  ],
};
