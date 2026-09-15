import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE = resolve(__dirname, 'test-storage-state.json');

export default defineConfig({
  globalSetup: resolve(__dirname, 'scripts/global-setup.ts'),
  globalTeardown: resolve(__dirname, 'scripts/global-teardown.ts'),
  testDir: './scripts',
  timeout: 45000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html', { open: 'never', locale: 'zh-CN' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    viewport: { width: 1280, height: 720 },
    // 浏览器通道：默认 Playwright 自带 chrome-headless-shell；受限环境（如 CI/沙箱）
    // 下该二进制会以 0xC0000409 直接崩出（整个 browser 进程退出，表现为 Page crashed）。
    // 那种环境设 PW_BROWSER_CHANNEL=chromium 切到完整 chromium 的 headless=new 即可。
    channel: process.env.PW_BROWSER_CHANNEL || undefined,
    actionTimeout: 5000,
    storageState: STORAGE_STATE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  outputDir: './test-results',
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
