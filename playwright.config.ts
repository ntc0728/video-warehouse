import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE = resolve(__dirname, 'test-storage-state.json');

export default defineConfig({
  globalSetup: resolve(__dirname, 'scripts/global-setup.ts'),
  testDir: './scripts',
  // 排除 gitignore 的旧测试备份目录（backup-specs/ 308 个用例不参与 E2E，否则全量测试会
  // 执行已废弃用例并产生稳定失败，掩盖真实回归信号）。详见 docs/KNOWN-ISSUES.md #2。
  testIgnore: '**/backup-specs/**',
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
