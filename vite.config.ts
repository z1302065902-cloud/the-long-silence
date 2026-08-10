import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works under any sub-path (GitHub Pages).
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        pricing: 'pricing.html',
        welcome: 'welcome.html',
      },
      output: {
        manualChunks(id: string) {
          // three.js is ~600KB minified — keep it in its own chunk so the
          // ~150KB game logic loads and binds UI early on slow links.
          if (id.includes('node_modules/three')) return 'three'
          // Paddle SDK 独立 chunk，定价页单独加载
          if (id.includes('node_modules/@paddle')) return 'paddle'
        },
      },
    },
  },
})
