import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  optimizeDeps: { include: ['sql.js', '@tanstack/react-query', 'lucide-react', 'sonner', 'framer-motion'] },
})
