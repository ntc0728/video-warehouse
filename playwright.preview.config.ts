/**
 * E2E 配置（dist 产物模式）：跑 vite preview 构建产物而非 dev server。
 * 背景：部分受限沙箱里 Chromium 加载 dev 页面（@vite/client + 按需 transform 流）
 * 会确定性 Page crashed，dist 产物稳定 —— 本机跑 E2E 撞崩溃时改用此配置。
 * 用法：node node_modules/vite/bin/vite.js preview --port 4173 &
 *       node node_modules/@playwright/test/cli.js test -c playwright.preview.config.ts
 */
import { type Config } from '@playwright/test';
import base from './playwright.config';

const config: Config = {
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4173' },
  // preview server 由外部启动（node node_modules/vite/bin/vite.js preview --port 4173）
  webServer: undefined,
  workers: 2,
};

export default config;
