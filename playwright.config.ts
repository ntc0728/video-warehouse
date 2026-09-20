import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE = resolve(__dirname, 'test-storage-state.json');

/**
 * E2E 端口策略：**动态向 OS 申请空闲端口**，不固定占任何一个端口。
 * 固定端口方案已被否决：任何写死的端口都可能正被别的服务使用，
 * 而测试无权要求它空出来、更无权杀它。E2E_PORT 仅供显式指定（如对着
 * 自己正跑的 dev server 测：E2E_PORT=3001 npx playwright test —— 用户自伤 opt-in）。
 */
async function resolveE2EPort(): Promise<number> {
  if (process.env.E2E_PORT) return Number(process.env.E2E_PORT);
  return new Promise((done, fail) => {
    const srv = net.createServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => done(port));
    });
  });
}

export default (async () => {
  const E2E_PORT = await resolveE2EPort();

  return defineConfig({
    globalSetup: resolve(__dirname, 'scripts/global-setup.ts'),
    globalTeardown: resolve(__dirname, 'scripts/global-teardown.ts'),
    testDir: './scripts',
    timeout: 45000,
    // 整轮硬封顶：即使出现未知挂死也必然退出，不允许无限期运行
    globalTimeout: process.env.CI ? 40 * 60 * 1000 : 30 * 60 * 1000,
    expect: { timeout: 5000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // 本地也留 1 次重试：dev 跑批在 2 worker 下偶发模块编译争用导致单条超窗
    // （smoke-player / browse 实测），重试成本远低于误报代价；封顶仍由 globalTimeout 保证
    retries: process.env.CI ? 2 : 1,
    // hermetic 化后并发瓶颈大减，但实测 4 worker 下 dev 编译+播放器初始化争用仍会把
    // 时序敏感用例（player cast / smoke-fs / home 稳定性）挤出 30s 内窗 → 稳定档取 3
    // （配合 suite 双阶段并行，总墙钟 ~4min 在 5min 预算内；调参见 e2e-suite 头注释）
    workers: process.env.CI ? 1 : 3,
    reporter: [
      ['html', { open: 'never', locale: 'zh-CN' }],
      ['list'],
    ],
    use: {
      baseURL: `http://127.0.0.1:${E2E_PORT}`,
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
    // 模式/预算开关（由 scripts/e2e-suite.mjs 组合使用）：
    //   E2E_SKIP_CONTRACT=1  排除骨架契约 B（需要生产单包 CSS，dev 下假失败，preview 专属）
    //   E2E_SKIP_SHOTS=1     排除 boot-splash-shots（截图取证脚本，非行为断言，移出 5min 预算默认套）
    testIgnore: [
      ...(process.env.E2E_SKIP_CONTRACT ? [/skeleton\.spec\.ts$/] : []),
      ...(process.env.E2E_SKIP_SHOTS ? [/boot-splash-shots\.spec\.ts$/] : []),
    ],
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
    ],
    webServer: {
      // 用 process.execPath（当前 node）直调 vite wrapper，**不要** `npm run dev`：
      // ① 受限环境里 npm/npx shim 可能不可用 → 起不来；② wrapper（scripts/e2e-vite-server.cjs）
      // 让命令行带测试独有标记，收尾只按标记精确杀自建 server，绝不按端口占用者乱杀。
      // strictPort：OS 刚释放的端口若被抢，宁可显式失败也不静默换端口骗过 baseURL。
      // 另外本配置只保证「没人先起 server 时能兜底起一个」；批量跑请走
      // `node scripts/e2e-skeleton.mjs`（内含自建 server + 健康轮询 + 超时封顶）。
      command: `"${process.execPath}" scripts/e2e-vite-server.cjs --port ${E2E_PORT} --strictPort`,
      url: `http://127.0.0.1:${E2E_PORT}`,
      reuseExistingServer: true,
      timeout: 60000,
    },
  });
})();
