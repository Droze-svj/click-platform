module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'error',
    'indent': ['error', 2],
    'no-mixed-spaces-and-tabs': 'error',
  },
  overrides: [
    {
      // CLI / dev / throwaway tooling — console is the intended output here,
      // and these never run as part of the request-serving app.
      files: ['scripts/**/*.js', 'scratch/**/*.js', 'scratch_*.js'],
      rules: { 'no-console': 'off' },
    },
    {
      // Test files: provide the Jest globals and allow console for test output.
      files: ['**/*.test.js', '**/*.spec.js'],
      env: { jest: true, node: true },
      rules: { 'no-console': 'off' },
    },
  ],
};
