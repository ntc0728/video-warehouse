# Scripts 目录

此目录用于存放项目中的脚本文件。

## 脚本分类

### 功能测试脚本

每个页面独立的 Playwright 测试脚本，覆盖功能点、UI 交互和 CSS 规范。
所有测试使用中文描述和中文输出结果。

| 文件 | 测试页面 / 主题 | 覆盖内容（describe 段） | 用例数 |
|------|----------|----------|--------|
| `home.spec.ts` | 首页 | 1.1 加载与初始态 / 1.2 HeroBanner 交互 / 1.3 分类快捷入口 / 1.3b 桌面分类入口 / 1.3c 宽屏分类面板 / 1.3d 宽屏 HeroBili 卡 / 1.3e 主图失败兜底 / 1.4 TMDBMovieRow / 1.5 全局交互 / 1.7 非手机小视口（768–1023） | 13 |
| `browse.spec.ts` | 浏览/搜索页 | 2.1 搜索模式切换 / 2.2 搜索 / 2.3 筛选与排序 / 2.4 CMS 直链搜索 / 2.7 移动端搜索 / 2.8 BrowseMobileBar / 2.9 筛选面板底部操作区 / 2.10 逻辑分页 / 2.11 分页器渲染门控 | 13 |
| `chart.spec.ts` | 热度榜 | CHART 热度榜页 | 5 |
| `detail.spec.ts` | 详情页 | 3.1 加载 / 3.2 Hero / 3.3 操作按钮 / 3.4 Tab 导航 / 3.5 概览 / 3.6 播放列表 / 3.8 推荐 / 3.11 剧照灯箱 | 8 |
| `player.spec.ts` | 播放页 | 4.1 加载与布局稳定 / 4.5 CMS 源管理 / 4.8 收藏与详情 / 4.11 移动端整改 / 4.12 移动端布局判定 / 4.13 投屏能力分端 / 4.14 PiP 契约 | 11 |
| `player-failover.spec.ts` | 播放页 | 源不可用自动故障转移 | 1 |
| `player-cms-error.spec.ts` | 播放页 | CMS 业务错误码失败态（PLAYER-095） | 1 |
| `iptv.spec.ts` | IPTV 直播页 | 5.1 加载 / 5.2 分组筛选 / 5.5 频道检测 / 5.7 懒加载与滚动 / 5.10 台标回退链 / 5.11 卡片收藏按钮 | 6 |
| `iptv-player.spec.ts` | IPTV 播放页 | 11.1 加载与频道匹配 / 11.2 平台适配 / 11.3 独立逻辑 / 11.4 chrome 尺寸契约 / 11.5 EPG 节目单 / 11.6 TV 遥控器焦点 | 11 |
| `settings.spec.ts` | 设置页 | 6.1 主题 / 6.2 TMDB / 6.3 视频源 / 6.4 播放 / 6.5 IPTV / 6.6 关于与彩蛋 / 6.7 个人资料 / 6.8 移动端菜单项 / 6.9 顶部搜索框 / 6.11 桌面左栏竖排导航 | 10 |
| `collections.spec.ts` | 收藏页 | 7.1 Tab 切换 / 7.2 影视收藏 / 7.4 批量管理 | 3 |
| `history.spec.ts` | 历史页 | 8.1 Tab 切换 + 8.2 影视历史 / 8.3 时间分组 / 8.4 去重 + 8.5 批量 / 8.6 桌面算珠时间轴 / 8.7 融合 Tab 与筛选面板 / 8.8 网格列数 | 6 |
| `person.spec.ts` | 人物页 | 10.1 加载 / 10.2 Hero / 10.3 作品列表 Tab / 10.4 卡片与懒加载 | 4 |
| `regression.spec.ts` | 历史专项合并 | 跨页联动回归 9 / 详情页回归 10 / 9.1 修复 4（冷启动·app 适配·布局一致性）/ UI 整改 3 / 全局问题 4 | 30 |
| `cross-tab.spec.ts` | 跨页签同步 | COL-CROSS-001 IDB 主键幂等 / USER-CROSS-001 BroadcastChannel 内存快照 / IPTV-CROSS-001 storage + isFavorite / SETTINGS-CROSS-001 白名单 storage | 4 |
| `smoke-player-fs-mobile.spec.ts` | 播放器全屏专项 | PC 桌面全屏 / 移动竖屏更多弹窗 / 移动横屏角落组+抽屉 / 移动竖屏点击语义 | 6 |
| `source-checker.spec.ts` | 源检测（按需 subpages） | 9.1 网速检测 / 9.6 Tab 与统计 | 2 |
| `proxy-setup.spec.ts` | 代理配置子页（按需 subpages） | PROXY-001 路由与结构 / PROXY-002·003 高亮 + Token 报错 | 2 |
| `skeleton.spec.ts` | 骨架契约（按需 skeleton） | 契约 A 色源唯一 / B 列数三方同源（逐断点）/ C 可见性+结构同构 / 播放页 shape | 18 |
| `boot-splash.spec.ts` | 启动骨架（按需 skeleton） | index.html 内联骨架：视口填充与路由感知 | 21 |
| `boot-splash-iso.spec.ts` | 七视口同构（按需 boot-iso） | `七视口同构 @375/768/1024/1280/1440/1920/2560px` × home/browse/collections 等 | 42 |
| `boot-splash-shots.spec.ts` | 骨架截图取证（按需 shots） | 多主题/多视口截图 + 摘除验证（人工核查，不进默认套） | 29 |

> **上表用例数为 2026-09-23 实测**（`npx playwright test --list`），全仓合计 **246 条 / 22 spec**。
> **唯一事实源 = `npm run test:count`**（`docs/agents/testing.md` 的生成块与之一致，由 `lint:test-map` 校验）；
> 加删用例后请重跑 `npm run test:count -- --write`，**不要手改上面任何一个数字**。
> 已删除的历史 spec（`cross-page` / `regression-detail` / `fix-2026-08` / `ui-fixes` / `global-fixes` /
> `collection|user|iptv|settings-cross-tab` / `verify-grid` / `search-features` / `mobile-web-sidebar` …）
> 已分别并入 `regression.spec.ts` 与 `cross-tab.spec.ts`（2026-09-09），其原条目不再有效。

### 测试辅助工具

| 文件 | 说明 |
|------|------|
| `global-setup.ts` | Playwright 全局设置（注入 TMDB Token / CORS 代理 / IPTV 代理） |
| `test-count-report.mjs` | **用例计数 / 测试映射一致性报告**（不启浏览器，1–2s）。`--check` 校验五项：映射引用的 spec 存在 / pattern 基路径存在 / grep 每个 `\|` 片段真命中 / 档位恒等式 / `testing.md` 生成块未过期（= `npm run lint:test-map`，已入 `lint:all` 第 7 门）；`--write` 把生成块写回 `docs/agents/testing.md` |
| `global-setup.ts` | Playwright 全局设置（注入 TMDB Token / CORS 代理 / IPTV 代理） |
| `run-tests.ps1` | 增量测试运行（按「未提交改动」自动跑对应 spec；命中 >3 spec 需 -Full 放行；playwright 段委派 `e2e-skeleton.mjs --dev`，带 -Budget 封顶） |
| `e2e-skeleton.mjs` | **全仓唯一跑 playwright 的入口**（自建 server + HTTP 200 探活 + 预算封顶 + 进程树收尾）；`test:e2e:*` / `e2e-suite.mjs` 各阶段 / `run-tests.ps1` 增量档共用。**别裸调 `playwright test`**（config 的 webServer 经 shell 启动，收尾会留孤儿 vite） |
| `e2e-suite.mjs` | 全量编排（Stage A dev 行为套 + Stage B preview 播放器），两段串跑并 merge blob 报告 |
| `localize-report.mjs` | Playwright HTML 报告中文化后处理 |

### 构建脚本

| 文件 | 说明 |
|------|------|
| `build-android.bat` | Android 构建（批处理） |
| `build-android.ps1` | Android 构建（PowerShell） |
| `generate-icons.mjs` | Android 图标生成（sharp 库） |
| `generate-icons.ps1` | Android 图标生成（PowerShell） |
| `css-px-to-token.mjs` | CSS 硬编码 px → Design Token 自动替换（项目约定：组件视觉尺寸一律走 token，仅逻辑阈值可保留字面量；用法见 `docs/KNOWLEDGE.md` ADR-006） |
| `clean-compressed.js` | 清理 dist 中 .gz/.br 预压缩文件 |

### 开发工具

| 文件 | 说明 |
|------|------|
| `check-dev-server.ps1` | 检查开发服务器端口占用 |
| `close.ps1` | 关闭 agent-browser 进程 |
| `backup-target-files.mjs` | 批量备份指定源文件 |
| `split-single-line-decls.mjs` | CSS 单行声明拆分为多行 |
| `optimize-deps.mjs` | postinstall 钩子：把 Vite 首次「依赖预打包」前移到安装阶段，消除 dev 冷启动白屏（`VITE_SKIP_OPTIMIZE=1` 跳过；CI/CAPACITOR 自动跳过） |

### 备份

| 目录 | 说明 |
|------|------|
| `backup-specs/` | 旧版测试脚本备份（308 个用例，已 gitignore，**不参与 E2E**；`playwright.config.ts` 需配置 `testIgnore` 排除，见「测试基建修复」） |

## 增量测试规则

修改文件时，只运行对应页面的测试脚本：

| 修改路径 | 运行测试 |
|----------|----------|
| `src/pages/Home/**` | `npx playwright test scripts/home.spec.ts` |
| `src/pages/Detail/**` | `npx playwright test scripts/detail.spec.ts scripts/regression-detail.spec.ts` |
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
| `src/components/Layout/**` | `npx playwright test scripts/cross-page.spec.ts scripts/home.spec.ts scripts/browse.spec.ts` |

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
| **默认套**（mock，推荐） | `npm run test:e2e` | 日常全量（A dev 行为 + B preview 播放器，串行 ≤300s） | 无（不调用真实 API） |
| 单 spec 调试 | `node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]` | 开发中定位 | 无 |
| **真实 API 模式** | `TMDB_MOCK=false npm run test:e2e` | 发版前回归 | 有（调用真实 API） |

> ⚠️ **不要裸跑 `npx playwright test`**（除了 `--list` 校准用例数）：没有清场/健康轮询，
> 僵尸 dev server 会把每条 `goto` 耗满超时；且 `webServer.command` 是字符串，Windows 下经 shell 启动，
> 收尾只杀到 shell、vite 会成孤儿。实跑一律走 `test:e2e*` / `e2e-skeleton.mjs` / `e2e-suite.mjs`。

### 快速切换

```bash
# 日常全量（默认 mock，保护 Token）
npm run test:e2e

# 按需档（不进默认套，显式跑）
npm run test:e2e:skeleton     # 骨架契约 + 启动骨架（39 条）
npm run test:e2e:boot-iso     # 七视口同构（42 条）
npm run test:e2e:subpages     # 设置页子页 source-checker / proxy-setup（4 条）
npm run test:e2e:shots        # 启动骨架截图取证（29 条，人工核查）

# 发版前回归（关闭 mock，验证真实 API）
TMDB_MOCK=false npm run test:e2e

# 计数 / 映射一致性（不跑浏览器）
npm run test:count                     # 报告 + 校验
npm run test:count -- --write          # 同步 docs/agents/testing.md 生成块
npm run lint:test-map                  # 只校验（lint:all 第 7 门）

# 用 run-tests.ps1 增量测试
.\scripts\run-tests.ps1                    # mock 模式（默认；自动侦测「未提交改动」）
.\scripts\run-tests.ps1 -Since HEAD~1      # 相对某 ref 的改动
.\scripts\run-tests.ps1 -Budget 60         # 收紧单轮墙钟预算（默认增量 180s / -Full 1200s，到点击杀退码 2）
.\scripts\run-tests.ps1 -Full -Retries 2 -Group regression   # 发版回归档（13 spec / 121 条）
.\scripts\run-tests.ps1 -RealApi           # 真实 API 模式
# 注：自动侦测命中 >3 个 spec 会 exit 2 拦下（防无感受跑全量回归）；要跑请显式 -Full
# 注：playwright 段由 scripts/e2e-skeleton.mjs --dev 代跑（自建 server + 探活 + 预算封顶 + 进程树收尾）
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
