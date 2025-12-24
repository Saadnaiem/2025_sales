import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    base: command === 'serve' ? '/' : '/',
    build: {
      rollupOptions: {
        // Add 'external' to tell Rollup not to bundle these packages.
        // They are provided at runtime by the importmap in index.html.
        external: ['jspdf', 'jspdf-autotable'],
        output: {
          manualChunks(id: string) {
            // Group large vendor libraries into a separate chunk to improve performance
            // and resolve the chunk size warning.
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('papaparse')) {
                return 'vendor';
              }
            }
          },
        },
      },
    },
  };
  return config;
})
