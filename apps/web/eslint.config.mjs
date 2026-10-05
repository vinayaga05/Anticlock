/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', '.turbo/**'],
  },
];

export default config;
