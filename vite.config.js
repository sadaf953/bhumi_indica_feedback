import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Two real pages: /  (customer form)  and  /admin/  (dashboard).
// base './' = relative paths, so the same build works at
// <user>.github.io/<repo>/, at feedback.bhumiindica.in, or uploaded to Hostinger.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        form: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
