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
    'no-console': 'warn',
    'indent': ['error', 2],
    'no-mixed-spaces-and-tabs': 'error',
    'no-case-declarations': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
};
