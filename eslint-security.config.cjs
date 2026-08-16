
module.exports = {
  plugins: ['@firebase/security-rules'],
  extends: ['plugin:@firebase/security-rules/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@firebase/security-rules/no-untrusted-get': 'warn',
  },
};
