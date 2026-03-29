import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: '/tmp/vite-cache',
  server: {
    proxy: {
      '/api/markets': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/markets/, '/markets'),
      },
      '/api/data-trades': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data-trades/, '/trades'),
      },
      '/api/data-activity': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data-activity/, '/activity'),
      },
      '/api/leaderboard': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/leaderboard/, '/v1/leaderboard'),
      },
      '/api/events': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/events/, '/events'),
      },
      '/api/kalshi/markets': {
        target: 'https://api.elections.kalshi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kalshi\/markets/, '/trade-api/v2/markets'),
      },
      '/api/kalshi/events': {
        target: 'https://api.elections.kalshi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kalshi\/events/, '/trade-api/v2/events'),
      },
      '/api/data-positions': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data-positions/, '/positions'),
      },
    },
  },
})
