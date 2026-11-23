const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
];
