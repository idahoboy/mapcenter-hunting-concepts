import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/ifwis': {
        target: 'https://idfg.idaho.gov',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
