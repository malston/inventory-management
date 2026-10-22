/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000
  },
  test: {
    environment: 'jsdom',
    // West of UTC, so date-only strings parsed as UTC show the previous day
    env: { TZ: 'America/Los_Angeles' }
  }
})
