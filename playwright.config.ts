import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    viewport: { width: 375, height: 812 },
    actionTimeout: 5000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
