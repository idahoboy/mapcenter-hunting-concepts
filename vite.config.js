import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/opportunity-search': {
        target: process.env.IDFG_AI_DRUPAL_URL || 'https://drupal-ai-app.ddev.site',
        changeOrigin: true,
        secure: false,
      },
      '/ifwis': {
        target: 'https://idfg.idaho.gov',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
