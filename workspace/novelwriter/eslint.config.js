import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import unusedImports from 'eslint-plugin-unused-imports'

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  URL: 'readonly',
  TextDecoder: 'readonly',
  crypto: 'readonly',
  console: 'readonly',
  structuredClone: 'readonly'
}

const nodeGlobals = {
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly'
}

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'node_modules/**',
      'dist/**',
      'release/**',
      'electron.vite.config.ts',
      'postcss.config.js',
      'tailwind.config.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'unused-imports': unusedImports },
    languageOptions: {
      globals: { ...browserGlobals, ...nodeGlobals }
    },
    rules: {
      // 宽松基线：先拦截真实问题，风格类规则后续再收紧
      '@typescript-eslint/no-explicit-any': 'warn',
      'unused-imports/no-unused-imports': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-undef': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // 文件名净化里使用控制字符正则是有意为之
      'no-control-regex': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...nodeGlobals, console: 'readonly' }
    }
  }
)
