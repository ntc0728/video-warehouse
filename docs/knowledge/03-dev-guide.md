# 开发指南

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

## 开发指南

### 1. 环境准备

#### 1.1 系统要求

- **Node.js**: >= 18
- **npm**: >= 9
- **操作系统**: Windows / macOS / Linux

#### 1.2 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd video-warehouse

# 安装依赖
npm install
```

#### 1.3 配置 TMDB

1. 前往 [TMDB](https://www.themoviedb.org/settings/api) 申请 API 密钥（免费）
2. 进入应用设置页面，填入 TMDB Access Token
3. 首页将自动加载热门影视数据

### 2. 开发命令

#### 2.1 启动开发服务器

```bash
npm run dev
```

访问 http://127.0.0.1:3001

#### 2.2 代码检查

```bash
# 完整检查（推荐提交前运行）
npm run lint:all

# 单独检查
npm run lint          # ESLint 检查
npm run lint:css      # Stylelint 检查

# 自动修复
npm run lint:fix      # 修复 ESLint 问题
npm run lint:css:fix  # 修复 CSS 问题
```

#### 2.3 测试

```bash
# 单元测试
npm run test           # 单次运行
npm run test:watch     # 监听模式
npm run test:coverage  # 覆盖率报告

# E2E 测试（mock 模式，默认）
npm run test:e2e       # 唯一默认入口（e2e-suite 两阶段，A dev 行为 + B preview 播放器，串行 ≤300s）
npm run test:count     # 用例计数 / 测试映射一致性报告（不跑浏览器，1–2s）

# E2E 增量测试（按「未提交改动」自动匹配 spec；相对 ref 用 -Since HEAD~1）
npm run test:changed    # run-tests.ps1（默认侦测未提交改动；命中 >3 spec 会 exit 2 拦下）
npm run test:smoke     # 冒烟组（home/browse/player，与改动侦测取交集）
npm run test:regression # 回归组（13 个 spec / 121 条，含 -Full -Retries 2）
```

**测试策略要点**（详见 `scripts/README.md` 与 `docs/agents/testing.md`）：

- **TMDB Mock 策略**：`scripts/fixtures/mock-tmdb.ts` 拦截 `api.tmdb.org` 请求返回本地 mock 数据；默认模式无 Token 风险。真实 API 模式：`TMDB_MOCK=false npm run test:e2e`（发版前回归用）。
- **不要裸跑 `npx playwright test`**：只有 `--list` 校准用例数可以裸跑；实跑一律走 `test:e2e*` /
  `e2e-skeleton.mjs` / `e2e-suite.mjs`（自建 server + 探活 + 预算封顶 + 进程树收尾）。裸跑会因
  `webServer.command` 经 shell 启动而留孤儿 vite，进程不返回。
- **增量映射**：改 `src/pages/Xxx/` 只跑对应 spec；改共享组件按 `run-tests.ps1` 的 `$uiPrecisionMap` /
  `$uiTestMap` 跑受影响 spec；改 `src/stores/**` / `src/services/**` / `src/hooks/**` / `src/lib/**` 会额外跑 vitest。
  **详情页改动** = `detail.spec.ts` + `regression.spec.ts`（其「详情页回归」段）；**代理配置子页** = `proxy-setup.spec.ts`。
  完整「源文件 → spec → 用例数」事实表见 `docs/agents/testing.md` 的生成块（`npm run test:count` 产出）。
- **计数与映射一律不手写**：`npm run test:count -- --write` 生成 `testing.md` 的口径总表；
  `npm run lint:test-map`（`lint:all` 第 7 门）校验「引用的 spec 存在 / pattern 基路径存在 /
  grep 片段真命中 / 档位恒等式 / 文档未过期」。当前口径：全仓 246 条 / 22 spec，默认套 132 条 / 16 spec，
  回归组 121 条 / 13 spec（2026-09-23 `--list` 实测）。`scripts/backup-specs/` 旧测试备份不在 `testDir` 覆盖内。
- **跑前须知**：E2E 端口由 **OS 动态分配**，跑批器自建 server 并做 HTTP 200 探活，**不需要你先起 `npm run dev`**
  （`E2E_PORT=3001` 只是显式复用你自己那个 dev server 的逃生门）。并发由套件固定（Stage A `--workers=3` /
  Stage B `--workers=5`），**不要手加 `--workers`**。⚠️ 若显式复用 3001 的 dev server，Vite 转换缓存可能
  返回改动前的模块 → e2e 打到旧代码；改完源码先验新鲜度或直接让跑批器自建 server。

#### 2.4 构建

```bash
# 构建生产版本
npm run build

# 本地预览
npm run preview
```

### 3. 代码规范

#### 3.1 TypeScript 规范

- 使用严格模式（`strict: true`）
- 优先使用 `interface` 定义对象类型
- 使用 `type` 定义联合类型、交叉类型
- 避免使用 `any`，使用 `unknown` 替代

```typescript
// ✅ 推荐
interface Video {
  id: string;
  title: string;
  sources: VideoSource[];
}

type VideoType = 'movie' | 'tv';

// ❌ 避免
const data: any = {};
```

#### 3.2 React 组件规范

- 使用函数组件 + Hooks
- 组件文件使用 PascalCase
- 使用 `export default` 导出组件
- Props 使用 `interface` 定义

```typescript
// ✅ 推荐
interface VideoCardProps {
  video: Video;
  onClick?: (video: Video) => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <div onClick={() => onClick?.(video)}>
      {video.title}
    </div>
  );
}
```

#### 3.3 CSS 规范

- 使用 BEM 命名规范
- 使用 CSS 变量（Design Tokens）
- 避免使用 `px`，使用 CSS 变量
- 使用 Tailwind CSS 工具类

```css
/* ✅ 推荐 */
.video-card {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.video-card__title {
  font-size: var(--text-base);
}

/* ❌ 避免 */
.video-card {
  padding: 12px;
  border-radius: 8px;
}
```

#### 3.4 状态管理规范

- 使用 Zustand 进行状态管理
- 使用 selector 订阅状态
- 避免全量订阅

```typescript
// ✅ 推荐（仅订阅需要的切片，避免全量订阅导致无关渲染）
const channels = useIPTVStore((s) => s.channels);

// ❌ 避免（全量解构，任何状态变化都会触发重渲染）
const { channels, groups, filter } = useIPTVStore();
```

### 4. 项目配置

#### 4.1 路径别名

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

#### 4.2 Vendor 拆分

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'radix-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
          'state-vendor': ['zustand'],
          'hls-vendor': ['hls.js'],
          'idb-vendor': ['idb'],
          'http-vendor': ['axios'],
          'utils-vendor': ['clsx']
        }
      }
    }
  }
});
```

---

