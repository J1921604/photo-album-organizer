import { defineConfig } from 'vite'

export default defineConfig({
  root: './src',
  base: '/photo-album-organizer/',  // リポジトリ名と一致させる（photo-album-organizer）
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          sqljs: ['sql.js']
        }
      }
    }
  },
  server: {
    open: true,
    port: 5173,
    mime: {
      'application/wasm': ['wasm']
    },
    fs: {
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.wasm'],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['../tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
