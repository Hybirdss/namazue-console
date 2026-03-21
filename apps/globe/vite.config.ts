import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: 'inline',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into parallel-loadable chunks.
          // Combined they were 2.3MB in a single chunk — browser blocked on download.
          maplibre: ['maplibre-gl'],
          deckgl: [
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/mapbox',
            '@deck.gl/aggregation-layers',
            '@deck.gl/geo-layers',
            '@deck.gl/mesh-layers',
            '@deck.gl/extensions',
          ],
          loaders: [
            '@loaders.gl/core',
            '@loaders.gl/worker-utils',
          ],
          pmtiles: ['pmtiles', 'protomaps-themes-base'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/plateau-proxy': {
        target: 'https://plateau.geospatial.jp',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/plateau-proxy/, ''),
      },
      // Dev proxy for Namazue API (worker running on localhost:8787)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
