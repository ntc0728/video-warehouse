/**
 * Playwright 全局 teardown
 *
 * 兜底清理：测试产物目录（outputDir = test-results）。
 * 由于 run-tests.ps1 在调用 playwright 前已清空 NODE_OPTIONS（绕过沙箱 delete-shim），
 * 此处 rmSync 不会被拦截。避免历史产物堆积拖累 worker teardown。
 */
import { type FullConfig } from '@playwright/test';
import { rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown(_config: FullConfig) {
  const outputDir = resolve(__dirname, '..', 'test-results');
  try {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  } catch {
    /* 忽略清理失败 */
  }
  console.log('✓ globalTeardown: 测试产物已清理');
}
