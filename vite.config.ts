import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import viteCompression from 'vite-plugin-compression'

/**
 * Vite 构建配置
 *
 * 优化策略（与 OuonnkiTV 对齐）：
 * 1. 路由级代码分割（src/routes.tsx 中通过 React.lazy 实现）
 * 2. Vendor 拆分（manualChunks）：核心框架、UI、状态、播放器等独立打包
 *    → 浏览器可独立缓存 vendor chunk，主代码更新时 vendor 仍命中
 * 3. build.target = 'es2020'：触发 Vite 自动注入 <link rel="modulepreload">
 * 4. cssCodeSplit = true：CSS 按 chunk 拆分，避免单 CSS 文件过大
 *
 * Capacitor 适配：
 * - CAPACITOR=true 时 base 设为 './'，确保 Android WebView 中本地资源路径正确
 * - Web 端保持 base='/'，部署到 Cloudflare Pages / 任何静态服务器不受影响
 */
export default defineConfig({
  plugins: [
    react(),
    // Capacitor 构建不需要预压缩（Android WebView 直接读本地文件）
    ...(process.env.CAPACITOR === 'true' ? [] : [
      viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
      viteCompression({ algorithm: 'gzip', ext: '.gz' }),
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Capacitor 原生打包使用相对路径，Web 部署使用绝对路径
  base: process.env.CAPACITOR === 'true' ? './' : '/',
  server: {
    port: 3001,
    host: '127.0.0.1',
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 使用 terser 替代 esbuild，支持更激进的混淆压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        pure_getters: true,
        unsafe_arrows: true,
        unsafe_methods: true,
        toplevel: true,
        drop_console: true,
        drop_debugger: true,
        ecma: 2020,
      },
      mangle: {
        toplevel: true,
        module: true,
        properties: false,
      },
      format: {
        comments: false,
        ecma: 2020,
      },
      ecma: 2020,
    },
    // 启用 CSS 代码分割（按页面 chunk 自动拆分 CSS）
    cssCodeSplit: true,
    // 输出目标：es2020 触发 Vite 自动注入 modulepreload + 减小 JS 体积
    target: 'es2020',
    // Chunk 大小警告阈值（kB）：从默认 500 提升到 800，
    // 因为我们采用 vendor 拆分后，vendor 体积可能略大于默认阈值
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        /**
         * Vendor 拆分策略
         * 浏览器可独立缓存每个 vendor chunk；主代码更新时 vendor 仍命中
         */
        manualChunks(id) {
          // 仅处理 node_modules 依赖
          if (!id.includes('node_modules')) return

          // 核心框架
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }

          // Radix UI 按功能拆分：Dialog 最常用独立 chunk，其余表单组件合并
          if (id.includes('/@radix-ui/react-dialog')) {
            return 'radix-dialog'
          }
          if (
            id.includes('/@radix-ui/react-radio') ||
            id.includes('/@radix-ui/react-slider') ||
            id.includes('/@radix-ui/react-switch') ||
            id.includes('/@radix-ui/react-progress')
          ) {
            return 'radix-form'
          }
          if (id.includes('/@radix-ui/react-tabs')) {
            return 'radix-tabs'
          }

          // 状态管理
          // 注意：必须把 barrel file @/stores/index.ts 也归入 state-vendor，
          // 否则它会被多个 lazy chunk 重复引用，引发循环 chunk 警告
          // 路径匹配使用正反斜杠双向匹配（兼容 Windows 绝对路径）
          if (
            id.includes('/zustand/') ||
            id.includes('\\zustand\\') ||
            id.includes('/src/stores/') ||
            id.includes('\\src\\stores\\')
          ) {
            return 'state-vendor'
          }

          // HLS.js（直播流播放）
          if (id.includes('/hls.js/')) {
            return 'hls-vendor'
          }

          // DASH.js（DASH 流播放）
          if (id.includes('/dashjs/')) {
            return 'dash-vendor'
          }

          // IndexedDB 封装
          if (id.includes('/idb/')) {
            return 'idb-vendor'
          }

          // 图标库（lucide-react 被几乎所有页面引用，单独 chunk 提升缓存命中率）
          if (id.includes('/lucide-react/') || id.includes('/lucide-static/')) {
            return 'icons-vendor'
          }

          // HTTP 请求（axios）
          if (id.includes('/axios/')) {
            return 'http-vendor'
          }

          // 通用工具：dayjs / clsx / tailwind-merge 等
          if (
            id.includes('/dayjs/') ||
            id.includes('/clsx/') ||
            id.includes('/tailwind-merge/')
          ) {
            return 'utils-vendor'
          }
        },
      },
    },
  },
})
