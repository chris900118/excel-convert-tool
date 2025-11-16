// --- 这是 vite.config.ts 的全部内容 (V1.3 净化版) ---
// (此版本移除了所有 __dirname)

import { defineConfig } from 'vite'
import path from 'node:path' // 保留 path 模块，以防万一
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        // 【关键修复】: 移除了 path.join(__dirname, ...)
        // 插件会自动从根目录解析
        input: 'electron/preload.ts',
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})