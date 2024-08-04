import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'node:path'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    react(),
    TanStackRouterVite({
      routesDirectory: resolve(__dirname, 'src/routes'),
      generatedRouteTree: resolve(__dirname, 'src/routeTree.gen.ts')
    })
  ]
})
