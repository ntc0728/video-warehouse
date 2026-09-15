# skills/ — 本项目自研 Skill 归档（协同共享）

> 本目录把**本项目自研 / 定制的 AI Skill** 随仓库共享，保证协作者 clone 后拿到一致的能力约定。
> 上游清单见 `docs/agents/RULES-MANIFEST.md`。

## 内容

| Skill | 用途 | 适用场景 |
| --- | --- | --- |
| `fullscreen-overlay-portal/` | 全屏遮挡下 portal 浮层（toast / 菜单 / 弹窗）不可见的排查与修复模式；含 Playwright `toBeVisible` 遮挡假绿教训 | 播放器 / 应用全屏场景的浮层问题；React + portal + 元素级全屏 |
| `check-environment/` | 会话开始时的环境检测与编码防护（UTF-8 乱码、PowerShell 版本、包管理器 lockfile、行尾、临时目录、BOM） | 每条会话开始时；Windows / macOS / Linux 通用（Windows 专属规则在非 Windows 自动跳过） |

## 安装到本地 Skill 目录

解压 `project-skills.zip` 后，把对应 skill 目录放入以下任一位置：

- **用户级（跨项目可用）**：`~/.workbuddy/skills/`（Windows：`C:\Users\<user>\.workbuddy\skills\`）
- **项目级（仅本项目）**：`<repo>/.workbuddy/skills/`（已被 `.gitignore` 忽略，不入库）

```
# 例：用户级安装（Windows PowerShell）
Expand-Archive -Path .\skills\project-skills.zip -DestinationPath "$env:USERPROFILE\.workbuddy\skills" -Force
```

## 说明

- 本目录**仅收录自研 / 本项目定制 skill**；第三方 marketplace skill（如通用 workflow / 设计 / 金融数据类）不随仓库分发，避免授权与噪声问题。
- `_meta.json` / `_user_meta.json` / `_icon.png` 等本机安装元数据已剔除，只保留 `SKILL.md` 与随附脚本。
- 新增自研 skill 时，请同步更新本表与 `project-skills.zip`。
