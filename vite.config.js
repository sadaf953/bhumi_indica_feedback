import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative, so the same build works on
// GitHub Pages (username.github.io/repo/) and later on feedback.bhumiindica.in
export default defineConfig({
  plugins: [react()],
  base: './',
})
