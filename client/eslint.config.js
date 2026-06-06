import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // VideoPanel adds <track> dynamically — ESLint can't see it statically.
      'jsx-a11y/media-has-caption': 'off',
      // autoFocus on the first focusable element inside a dialog is correct WCAG practice.
      'jsx-a11y/no-autofocus': 'warn',
      // Neutral fills/borders must use the helpers in theme/styleUtils.js so every
      // surface stays in sync. Catches new inline neutral rgba() before it spreads.
      'no-restricted-syntax': ['warn', {
        selector: "Literal[value=/rgba\\((255, ?255, ?255|0, ?0, ?0)/]",
        message: 'Use the neutral*/border helpers from theme/styleUtils.js instead of inline neutral rgba().',
      }],
    },
  },
  {
    // Allowed literal rgba(): the helper definitions, the marketing pages (their
    // own token system), and the auth screens (a fixed always-dark branded panel
    // whose white-alpha values are intentional, not theme-neutral fills).
    files: [
      'src/theme/**',
      'src/components/landing/**',
      'src/components/common/AuthShell.jsx',
      'src/pages/Login.jsx',
      'src/pages/Register.jsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
