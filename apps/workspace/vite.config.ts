import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    target: 'es2022',
  },
  base: process.env.NODE_ENV === 'production' ? '/AGI-OS/workspace/' : '/',
});
