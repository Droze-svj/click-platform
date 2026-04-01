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
};
