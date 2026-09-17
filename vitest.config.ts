import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [{
    name: 'sql-wasm-url-fix',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('sql-wasm.wasm?url')) return '\0sql-wasm-path'
    },
    load(id) {
      if (id === '\0sql-wasm-path') {
        const p = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
        return `export default ${JSON.stringify(p)}`
      }
    },
  }],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/lib/__tests__/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
