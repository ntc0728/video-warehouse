# Scripts 目录

此目录用于存放项目中的脚本文件。

## 脚本分类

### 功能测试脚本

每个页面独立的 Playwright 测试脚本，覆盖功能点、UI 交互和 CSS 规范。
所有测试使用中文描述和中文输出结果。

| 文件 | 测试页面 | 覆盖内容 | 用例数 |
|------|----------|----------|--------|
| `home.spec.ts` | 首页 | Token 校验、HeroBanner、分类入口、行数据、骨架屏、回到顶部 | 21 |
| `browse.spec.ts` | 浏览/搜索页 | 搜索模式切换、搜索功能、筛选排序、CMS 搜索、懒加载 | 10 |
| `detail.spec.ts` | 详情页 | Hero 区域、操作按钮、Tab 导航、概览/播放列表/季信息 Tab、推荐 | 18 |
| `player.spec.ts` | 播放页 | 页面加载、CMS 源管理、面板折叠、收藏与详情 | 8 |
| `iptv.spec.ts` | IPTV 直播页 | 页面加载、分组筛选、频道检测、懒加载、返回顶部 | 7 |
| `iptv-player.spec.ts` | IPTV 播放页 | 频道匹配、返回按钮、平台适配 | 4 |
| `settings.spec.ts` | 设置页 | 主题切换、TMDB/视频源/IPTV 配置、播放设置、版本号彩蛋 | 12 |
| `collections.spec.ts` | 收藏页 | Tab 切换、影视/IPTV 收藏、批量管理 | 4 |
| `history.spec.ts` | 历史记录页 | Tab 切换、时间分组、时间轴导航、批量管理 | 6 |
| `source-checker.spec.ts` | 源检测页 | 网速检测、Tab 切换、统计卡片 | 5 |
| `person.spec.ts` | 人物页 | 页面加载、Hero 区域、作品列表 Tab、懒加载 | 7 |
| `cross-page.spec.ts` | 页面交叉跳转 | 首页→详情/浏览、详情→播放/人物、深链返回、Keep-Alive 状态保持 | 14 |

### 测试辅助工具

| 文件 | 说明 |
|------|------|
| `global-setup.ts` | Playwright 全局设置（注入 TMDB Token / CORS 代理 / IPTV 代理） |
| `run-tests.ps1` | 增量测试运行（根据 git diff 自动跑对应 spec） |
| `localize-report.mjs` | Playwright HTML 报告中文化后处理 |

### 构建脚本

| 文件 | 说明 |
|------|------|
| `build-android.bat` | Android 构建（批处理） |
| `build-android.ps1` | Android 构建（PowerShell） |
| `generate-icons.mjs` | Android 图标生成（sharp 库） |
| `generate-icons.ps1` | Android 图标生成（PowerShell） |
| `css-px-to-token.mjs` | CSS 硬编码 px → Design Token 自动替换 |
| `clean-compressed.js` | 清理 dist 中 .gz/.br 预压缩文件 |

### 开发工具

| 文件 | 说明 |
|------|------|
| `check-dev-server.ps1` | 检查开发服务器端口占用 |
| `close.ps1` | 关闭 agent-browser 进程 |
| `backup-target-files.mjs` | 批量备份指定源文件 |
| `split-single-line-decls.mjs` | CSS 单行声明拆分为多行 |

### 备份

| 目录 | 说明 |
|------|------|
| `backup-specs/` | 旧版测试脚本备份（15 个文件） |

## 增量测试规则

修改文件时，只运行对应页面的测试脚本：

| 修改路径 | 运行测试 |
|----------|----------|
| `src/pages/Home/**` | `npx playwright test scripts/home.spec.ts` |
| `src/pages/Detail/**` | `npx playwright test scripts/detail.spec.ts` |
| `src/pages/Settings/**` | `npx playwright test scripts/settings.spec.ts` |
| `src/pages/Browse/**` | `npx playwright test scripts/browse.spec.ts` |
| `src/pages/Collections/**` | `npx playwright test scripts/collections.spec.ts` |
| `src/pages/History/**` | `npx playwright test scripts/history.spec.ts` |
| `src/pages/IPTV/**` | `npx playwright test scripts/iptv.spec.ts scripts/iptv-player.spec.ts` |
| `src/pages/Player/**` | `npx playwright test scripts/player.spec.ts` |
| `src/pages/SourceChecker/**` | `npx playwright test scripts/source-checker.spec.ts` |
| `src/pages/Person/**` | `npx playwright test scripts/person.spec.ts` |
| `src/components/UniversalPlayer/**` | `npx playwright test scripts/player.spec.ts scripts/iptv-player.spec.ts` |
| `src/components/RecordShell/**` | `npx playwright test scripts/collections.spec.ts scripts/history.spec.ts` |
| `src/stores/**` | `npm test`（vitest 单元测试） |
| `src/hooks/**` | `npm test`（vitest 单元测试） |

### 全量测试（提交代码前）

提交代码前必须运行全量测试：

```bash
# 日常提交（mock 模式）
npm run lint:all && npx playwright test scripts/

# 发版回归（真实 API 模式）
npm run lint:all && TMDB_MOCK=false npx playwright test scripts/
```

### 测试前置条件

Playwright 测试需要开发服务器运行：

```bash
npm run dev  # 端口 3001
```

## 测试环境配置

测试自动继承以下配置（由 `global-setup.ts` 注入）：

| 配置项 | 值 |
|--------|---|
| TMDB Access Token | `your_tmdb_token_here` |
| CORS 代理 | `https://your-video-proxy.example.com` |
| IPTV 代理 | `https://your-iptv-proxy.example.com` |
| 视频源 | 索引 0, 1, 6, 11, 21（5 个） |
| IPTV 源 | 索引 0, 2, 7（3 个） |

## TMDB Mock 策略

测试通过 `fixtures/mock-tmdb.ts` 拦截所有 `api.tmdb.org` 请求，返回本地 mock 数据。

### 两种模式

| 模式 | 命令 | 用途 | Token 风险 |
|------|------|------|-----------|
| **Mock 模式**（默认） | `npx playwright test` | 日常开发、CI/CD | 无（不调用真实 API） |
| **真实 API 模式** | `TMDB_MOCK=false npx playwright test` | 发版前回归 | 有（调用真实 API） |

### 快速切换

```bash
# 日常测试（默认 mock，保护 Token）
npx playwright test scripts/

# 发版前回归（关闭 mock，验证真实 API）
TMDB_MOCK=false npx playwright test scripts/

# 用 run-tests.ps1 增量测试
.\scripts\run-tests.ps1                    # mock 模式（默认）
.\scripts\run-tests.ps1 -RealApi           # 真实 API 模式
```

### Mock 覆盖范围

| API 端点 | Mock 行为 |
|---------|----------|
| `api.tmdb.org/**/trending/**` | 返回 20 条 trending 数据 |
| `api.tmdb.org/**/search/**` | 返回搜索结果列表 |
| `api.tmdb.org/**/discover/**` | 返回 discover 结果 |
| `api.tmdb.org/**/movie/**` | 返回电影详情（搏击俱乐部） |
| `api.tmdb.org/**/tv/**` | 返回剧集详情（权力的游戏） |
| `api.tmdb.org/**/person/**` | 返回人物详情（刘德华） |
| `api.tmdb.org/**/genre/**` | 返回类型列表 |
| `image.tmdb.org/**` | 返回 1x1 透明像素 |

## 使用规范

| 脚本类型 | 命名规范 | 示例 |
|----------|----------|------|
| 页面测试 | `<page-name>.spec.ts` | `home.spec.ts` |
| 交叉测试 | `cross-page.spec.ts` | 页面跳转交互 |
| 构建脚本 | `build-*.ps1` | `build-android.ps1` |
| 工具脚本 | `*.mjs` / `*.ps1` | `css-px-to-token.mjs` |

## 测试脚本编写规范

### 功能测试
- 每个页面独立一个 `.spec.ts` 文件
- 测试文件使用 `test.describe` 分组相关测试
- 使用中文 `test.describe` 和 `test` 名称
- 使用 `console.log('✅ / ⚠️ ...')` 输出中文检测结果

### 断言规范
- 使用 `expect()` 进行断言
- 异步操作使用 `await` 和 `waitForTimeout`
- 可选元素使用 `.catch(() => false)` 防止测试失败
- 每个断言后输出中文结果说明

## 注意事项

- 临时调试/验证脚本执行成功后应立即删除
- 仅保留覆盖项目整体行为的功能测试脚本
- 新增脚本需遵循上述命名规范
- 运行测试：`npx playwright test scripts/<test-name>.spec.ts`
