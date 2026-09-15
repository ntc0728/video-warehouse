# skills/ — 本项目 Skill 归档（协同共享）

> 本目录把**本项目自研 skill + 协同工作流所需的第三方 skill** 随仓库共享，保证协作者 clone 后拿到一致的能力与工作流约定。
> 上游清单见 `docs/agents/RULES-MANIFEST.md`。

## 内容（共 7 个）

| Skill | 来源 | 用途 | 适用场景 |
| --- | --- | --- | --- |
| `fullscreen-overlay-portal/` | 🔧 自研 | 全屏遮挡下 portal 浮层（toast / 菜单 / 弹窗）不可见的排查与修复模式；含 Playwright `toBeVisible` 遮挡假绿教训 | 播放器 / 应用全屏场景的浮层问题；React + portal + 元素级全屏 |
| `check-environment/` | 🔧 自研 | 会话开始时的环境检测与编码防护（UTF-8 乱码、PowerShell 版本、包管理器 lockfile、行尾、临时目录、BOM） | 每条会话开始时；Windows / macOS / Linux 通用 |
| `playwright-cli/` | 📦 第三方（skillhub） | Playwright CLI 浏览器自动化：导航、截图、填表、点击、会话管理、网络拦截、录制 | E2E 调试、页面交互验证、截图取证 |
| `frontend-design/` | 📦 第三方（skillhub） | 生产级前端界面设计：避免「AI 味」通稿审美，强调真实可运行代码与细节 | 写组件 / 页面 / 应用时的设计取向 |
| `tdd/` | 📦 第三方（[mattpocock/skills](https://github.com/mattpocock/skills)） | 测试驱动开发：红 → 绿 → 重构，行为优先 | 新功能 / 修 bug 走测试先行 |
| `grill-me/` | 📦 第三方（[mattpocock/skills](https://github.com/mattpocock/skills)） | 深度追问式方案审查：逐层拆解设计决策直到共识 | 方案 / 设计的压力测试 |
| `handoff/` | 📦 第三方（[mattpocock/skills](https://github.com/mattpocock/skills)） | 把当前对话压缩成交接文档，供下一个 agent 无缝接续 | 换会话 / 换人接手前 |

## 安装到本地 Skill 目录

解压 `project-skills.zip` 后，把需要的 skill 目录放入以下任一位置：

- **用户级（跨项目可用）**：`~/.workbuddy/skills/`（Windows：`C:\Users\<user>\.workbuddy\skills\`）
- **项目级（仅本项目）**：`<repo>/.workbuddy/skills/`（已被 `.gitignore` 忽略，不入库）

```powershell
# 例：用户级安装（Windows PowerShell）
Expand-Archive -Path .\skills\project-skills.zip -DestinationPath "$env:USERPROFILE\.workbuddy\skills" -Force
```

## 说明

- 本目录收录 **7 个**：自研 / 本项目定制 2 个 + 协同工作流第三方 5 个。**金融数据类第三方 skill（NeoData 金融搜索、WeStock Data）与本项目无关，不予收录**。
- 第三方 skill 版权归原作者 / 发布方所有，随仓库分发**仅为保证协作者工作流一致**；如原作者要求，可随时从本目录移除（移除后本仓库协同流程不受影响）。
- `_meta.json` / `_user_meta.json` / `_skillhub_meta.json` / `_icon.png` 等本机安装元数据已剔除，只保留 `SKILL.md` 与随附脚本。
- 第三方 skill 目录名已按 `SKILL.md` 的 `name` 字段规整（去掉 `-3__skillhub` / `-tool__skillhub` 等安装后缀）。
- 新增或调整 skill 时，请同步更新本表与 `project-skills.zip`（`Compress-Archive` 重打包）。
