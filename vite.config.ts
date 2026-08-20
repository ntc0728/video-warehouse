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
    // VITE_COMPRESS=false 可跳过压缩（本地开发/CI 加速）
    ...(process.env.CAPACITOR === 'true' || process.env.VITE_COMPRESS === 'false' ? [] : [
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
    // 预热常用模块：dev server 启动后立即 transform 核心模块，
    // 消除「首次打开浏览器 → 逐模块编译」的慢路径（感知上的首屏慢）
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/routes.tsx',
        './src/components/Layout/*',
        './src/components/Layout/routeConfig.ts',
        './src/components/Layout/AppLayout.tsx',
        './src/components/StickyHeader/StickyHeader.tsx',
        './src/stores/*',
        './src/services/*',
        './src/lib/*',
        './src/pages/Home/*',
        './src/pages/Browse/*',
        './src/assets/styles/index.css',
      ],
    },
  },
  build: {
    outDir: 'dist',
    // 恢复构建前清空 dist：历史上本地「安全删除防护（safe-delete）」会拦截 emptyDir 的
    // >50 文件批量删除导致构建失败，故此前关闭。现已实测批量删除不再被拦截，
    // 恢复清空以消除多次构建累积的陈旧产物（69MB / 1700+ 陈旧 js）拖慢 Pages 部署的问题。
    emptyOutDir: true,
    sourcemap: false,
    // 使用 esbuild 压缩（Vite 默认 minifier）：核心构建 16s→8s，比 terser 快约一倍，
    // 产物 gzip 后体积差距 <2%（dash-vendor 785KB→835KB raw，gzip 差距更小）。
    // terser passes:3 激进配置曾用于极致压缩，收益与构建时间不成比例，已移除。
    minify: 'esbuild',
    // 启用 CSS 代码分割（按页面 chunk 自动拆分 CSS）
    cssCodeSplit: true,
    // 输出目标：es2020 触发 Vite 自动注入 modulepreload + 减小 JS 体积
    target: 'es2020',
    // Chunk 大小警告阈值（kB）：vendor 拆分后个别 vendor（如 dashjs）略大于默认阈值。
    // dashjs 独立成 dash-vendor 且为 lazy 加载（播放 DASH 流才拉取），不阻塞首屏，
    // 故阈值提到 900 以消除「dash-vendor 804KB > 800KB」的非功能性告警。
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * Vendor 拆分策略
         * 浏览器可独立缓存每个 vendor chunk；主代码更新时 vendor 仍命中
         */
        manualChunks(id) {
          // 仅处理 node_modules 依赖（用户代码由 Rollup 自动提升到共享 chunk，无需手动分块）
          if (!id.includes('node_modules')) return

          // 状态管理
          // 注意：必须放在「核心框架」判断之前——zustand/esm/react/shallow.mjs 路径含 /react/，
          // 若后置会被 react 规则误归入 react-vendor，而它又依赖 state-vendor，
          // 引发 state-vendor ↔ react-vendor 循环 chunk 警告
          if (id.includes('/zustand/')) {
            return 'state-vendor'
          }

          // 核心框架（精确匹配 node_modules 下的包目录，避免误收路径中含 /react/ 的第三方包）
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('/node_modules/scheduler/')
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
        },
      },
    },
  },
})
