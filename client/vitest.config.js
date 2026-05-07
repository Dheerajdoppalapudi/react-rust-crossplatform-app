import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals:     true,
    environment: 'happy-dom',
    setupFiles:  ['./src/test/setup.js'],
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'lcov'],
      thresholds: { lines: 70 },
      exclude: [
        'src/test/**',
        'src/main.jsx',
        '**/*.config.*',
        '**/node_modules/**',
      ],
    },
  },
}))
