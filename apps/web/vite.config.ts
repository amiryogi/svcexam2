import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bundle @svi/shared from source in both dev and build.
  resolve: { conditions: ['development', ...defaultClientConditions] },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
