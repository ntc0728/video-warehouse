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
npx playwright test    # 运行所有测试

# E2E 增量测试（按 git diff 自动匹配 spec）
npm run test:smart     # run-tests.ps1 -AutoDetect
npm run test:smoke     # 冒烟组（home/browse/player）
npm run test:regression # 回归组（全量 spec 集合）
```

**测试策略要点**（详见 `scripts/README.md` 与 `AGENTS.md`「测试依赖映射」）：

- **TMDB Mock 策略**：`scripts/fixtures/mock-tmdb.ts` 拦截 `api.tmdb.org` 请求返回本地 mock 数据；默认模式无 Token 风险。真实 API 模式：`TMDB_MOCK=false npx playwright test`（发版前回归用）。
- **增量映射**：改 `src/pages/Xxx/` 只跑对应 spec；改共享组件（VideoCard/HeroBanner/Layout/StickyHeader/UniversalPlayer/RecordShell/StatusTabs/SearchBox/FilterBar/Toast 等）按 AGENTS.md 映射表跑所有受影响 spec；改 `src/stores/**` / `src/hooks/**` 跑 vitest。**详情页改动需同时跑 `detail.spec.ts` + `regression-detail.spec.ts`**。
- **测试基建约定**：`playwright.config.ts` 配置 `testIgnore: '**/backup-specs/**'` 排除 gitignore 的旧测试备份（308 用例不参与 E2E）；主目录 13 个 spec 共 181 用例应零失败。
- **跑前须知**：需要 dev server（`npm run dev`，端口 3001）；Playwright 配置 `reuseExistingServer: true`。

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

