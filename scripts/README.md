# Scripts 目录

此目录用于存放项目中的脚本文件。

## 脚本分类

### 功能测试脚本

每个页面独立的 Playwright 测试脚本，覆盖功能点、UI 交互和 CSS 规范。

| 文件 | 测试页面 | 覆盖内容 |
|------|----------|----------|
| `home.spec.ts` | 首页 | Hero Banner、分类导航、视频行、骨架屏、设备适配 |
| `detail.spec.ts` | 详情页 | Hero 区域、标签切换、播放/收藏、观看进度、推荐 |
| `settings.spec.ts` | 设置页 | 主题切换、开关组件、帮助提示、弹窗、源选择、持久化 |
| `browse.spec.ts` | 筛选页 | 搜索、筛选栏、建议、视频网格、无限滚动 |
| `collections.spec.ts` | 收藏页 | 标签系统、状态筛选、搜索、批量操作、删除确认 |
| `history.spec.ts` | 历史页 | 标签系统、时间线导航、状态筛选、批量操作 |
| `iptv.spec.ts` | IPTV 页 | 源筛选、分组筛选、搜索、频道网格、可用性检测 |
| `iptv-player.spec.ts` | IPTV 播放器 | 独立布局、播放器容器、频道信息、返回导航 |
| `player.spec.ts` | 播放器页 | 视频区域、侧边栏、CMS 源、剧集导航、自动播放 |
| `source-checker.spec.ts` | 源检测页 | 统计卡片、检测按钮、源表格、状态指示器 |
| `search-features.spec.ts` | 搜索功能 | 搜索历史、猜你想搜、热门搜索、关键词高亮 |
| `mobile-web-sidebar.spec.ts` | 移动端侧边栏 | data-device、菜单、导航、滚动锁定 |

### 构建脚本

| 文件 | 说明 |
|------|------|
| `build-android.bat` | Android 构建 |
| `build-android.ps1` | Android 构建 |
| `generate-icons.mjs` | 图标生成 |
| `generate-icons.ps1` | 图标生成 |
| `css-px-to-token.mjs` | CSS px 转 token |

### 开发工具

| 文件 | 说明 |
|------|------|
| `backup-target-files.mjs` | 文件备份 |
| `split-single-line-decls.mjs` | 代码格式化 |
| `check-dev-server.ps1` | 开发服务器检查 |
| `close.ps1` | 工具脚本 |

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
| `src/pages/IPTV/**` | `npx playwright test scripts/iptv.spec.ts` |
| `src/pages/Player/**` | `npx playwright test scripts/player.spec.ts` |
| `src/pages/SourceChecker/**` | `npx playwright test scripts/source-checker.spec.ts` |
| `src/components/UniversalPlayer/**` | `npx playwright test scripts/player.spec.ts scripts/iptv-player.spec.ts` |
| `src/components/SearchBox/**` | `npx playwright test scripts/search-features.spec.ts` |
| `src/components/Sidebar/**` | `npx playwright test scripts/mobile-web-sidebar.spec.ts` |
| `src/stores/**` | `npm test`（vitest 单元测试） |
| `src/hooks/**` | `npm test`（vitest 单元测试） |

### 全量测试（提交代码前）

提交代码前必须运行全量测试：

```bash
npm run lint:all && npx playwright test scripts/
```

### 测试前置条件

Playwright 测试需要开发服务器运行：

```bash
npm run dev  # 端口 3001
```

## 使用规范

| 脚本类型 | 命名规范 | 示例 |
|----------|----------|------|
| 页面测试 | `<page-name>.spec.ts` | `home.spec.ts` |
| 构建脚本 | `build-*.ps1` | `build-android.ps1` |
| 工具脚本 | `*.mjs` / `*.ps1` | `css-px-to-token.mjs` |

## 测试脚本编写规范

### 功能测试
- 每个页面独立一个 `.spec.ts` 文件
- 测试文件使用 `test.describe` 分组相关测试
- 使用 `test.beforeEach` 准备测试数据

### UI 交互测试
- 验证组件渲染和可见性
- 测试点击、输入、滚动等交互
- 验证状态变化和导航跳转

### CSS 规范测试
- 验证使用 CSS 变量（`var(--*)`）而非硬编码值
- 验证 BEM 命名规范（`block__element--modifier`）
- 验证响应式布局（mobile/desktop 适配）

### 断言规范
- 使用 `expect()` 进行断言
- 异步操作使用 `await` 和 `waitForTimeout`
- 可选元素使用 `catch(() => false)` 防止测试失败

## 注意事项

- 临时调试/验证脚本执行成功后应立即删除
- 仅保留覆盖项目整体行为的功能测试脚本
- 新增脚本需遵循上述命名规范
- 运行测试：`npx playwright test scripts/<test-name>.spec.ts`
