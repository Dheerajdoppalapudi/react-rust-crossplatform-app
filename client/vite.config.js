import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],

  // ─── Path aliases — eliminates ../../../../ chains ────────────────────────────
  resolve: {
    alias: {
      '@':           resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@services':   resolve(__dirname, 'src/services'),
      '@theme':      resolve(__dirname, 'src/theme'),
      '@lib':        resolve(__dirname, 'src/lib'),
      '@constants':  resolve(__dirname, 'src/constants'),
      '@pages':      resolve(__dirname, 'src/pages'),
    },
  },

  // ─── Dev server ───────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    strictPort: true,
  },

  // ─── Preview (production build local test) ───────────────────────────────────
  preview: {
    port: 4173,
    strictPort: true,
  },

  // ─── Build ────────────────────────────────────────────────────────────────────
  build: {
    // Hidden source maps: uploaded to Sentry for stack traces, not served publicly
    sourcemap: 'hidden',

    // Warn (and fail CI) when any single chunk exceeds 600 KB
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Split heavy vendor libs into separate cacheable chunks.
        // When only app code changes, browsers re-use the cached vendor chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Extract the exact package name to avoid false positives like
          // react-leaflet or react-markdown being bucketed into vendor-react.
          const after = id.split('node_modules/').at(-1)
          const pkg = after.startsWith('@')
            ? after.split('/').slice(0, 2).join('/')   // @scope/name
            : after.split('/')[0]                       // name

          // Core React runtime only (not react-* ecosystem packages)
          if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) {
            return 'vendor-react'
          }
          // MUI + Emotion — must stay together (MUI imports @emotion at runtime)
          if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) {
            return 'vendor-mui'
          }
          // Heavy visualisation — lazy-loaded in Phase 7, but split here for caching
          if (['mermaid', 'recharts', 'reactflow', '@xyflow', 'leaflet', 'react-leaflet', 'dagre'].includes(pkg)) {
            return 'vendor-viz'
          }
          // Rich text editor
          if (pkg.startsWith('@tiptap/')) {
            return 'vendor-editor'
          }
          // Math / markdown rendering + sanitization
          if (
            ['katex', 'react-markdown', 'react-syntax-highlighter', 'dompurify'].includes(pkg) ||
            pkg.startsWith('remark-') || pkg.startsWith('rehype-') ||
            pkg.startsWith('hast') || pkg.startsWith('mdast') || pkg.startsWith('micromark') ||
            ['unified', 'vfile', 'bail'].includes(pkg)
          ) {
            return 'vendor-media'
          }
        },
      },
    },
  },

  // ─── Global constants injected at build time ──────────────────────────────────
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
