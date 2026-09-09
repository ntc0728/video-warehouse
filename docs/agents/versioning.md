# 版本号管理

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## 版本号管理（Versioning）

> 版本号唯一可信源 = `package.json` 的 `version` 字段，由 release-please 依据 Conventional Commits 自动维护，**禁止手工乱改**。

### 1. 版本号规则（SemVer + 通道）

- 格式：`MAJOR.MINOR.PATCH[-预发布通道]`，例如 `0.1.0`、`1.2.3-beta.1`。
- **MAJOR（X）**：破坏性变更 / 里程碑。
- **MINOR（Y）**：新增可见功能（0.x 阶段破坏性变更也升 MINOR，因 API 尚未稳定）。
- **PATCH（Z）**：修复 / 样式 / 重构（无行为变化）。
- 预发布通道：`-alpha.N` / `-beta.N` / `-rc.N`；正式发布时去掉通道。
- 项目已发布：首次发布实测产出 `1.0.0`（2026-07），当前版本 `1.1.0`（见 `package.json` / `.release-please-manifest.json` / `CHANGELOG.md`，三者是唯一可信源）。


### 2. 自动版本（release-please）

- 配置：`.release-please-config.json`、`.release-please-manifest.json`（记录最近发布版，当前 `1.1.0`）。
- 工作流：`.github/workflows/release-please.yml`（监听 `master` 推送，已声明 `permissions: { contents: write, pull-requests: write }`）→ 自动开版 PR、更新 `package.json`/`CHANGELOG.md`、打 `vX.Y.Z` tag、生成 GitHub Release。
- 提交信息遵循 Conventional Commits：`feat:` 升 MINOR/PATCH、`fix:` 升 PATCH、`BREAKING CHANGE`/`feat!` 升 MINOR（0.x 阶段）。
- **首次发布实测为 `1.0.0`**（release-please 对首个 release 默认产出 `1.0.0`，而非 `0.1.0`）；后续按 SemVer 规则递增。
- ⚠️ **前置条件（让 release-please 能创建 PR，二选一）**：
  1. **首选（管理员，已实测可用）**：仓库 **Settings → Actions → General** 勾选 **「Allow GitHub Actions to create and approve pull requests」**，并将「Workflow permissions」设为 **Read and write permissions**。2026-07-31 实测：开启后默认 `GITHUB_TOKEN` 即可直接开版 PR（PR #1 / 1.1.0 成功创建，整条链路跑通）。
  2. **兜底（无 admin / 无法改仓库设置时）**：在仓库 **Settings → Secrets and variables → Actions → Repository secrets** 新增 `RELEASE_PLEASE_TOKEN`，值为一个带 `repo`（含 `public_repo`/`repo:status`/`read:org` 等足够权限）范围的 Personal Access Token；工作流已配置 `token: ${{ secrets.RELEASE_PLEASE_TOKEN || github.token }}` 自动优先使用它。该复选框只限制默认 `GITHUB_TOKEN`，用 PAT 可绕过。
  - 若两者都未满足，Action 会在开版 PR 步骤报 `GitHub Actions is not permitted to create or approve pull requests` 而失败（此时版本号已算好、CHANGELOG 已生成，仅缺 PR/tag/Release）。
- **本地兜底（无 admin / 无法配置 Secrets 时）**：用自己账号的 PAT（GitHub 账号 Settings → Developer settings → PAT，勾 `repo`）在本地跑，不依赖仓库 Secrets，也不受「禁止 Actions 创建 PR」限制。PAT 是**个人账号**创建（任何成员都能建），与仓库 admin 无关：
  ```powershell
  $env:GITHUB_TOKEN = "ghp_你的PAT"
  # 开版 PR（走 PAT，绕过仓库权限限制）
  npx release-please release-pr --repo-url ntc0728/video-warehouse
  # 在 GitHub 合并该 PR 后，生成本对应的 GitHub Release + tag
  npx release-please github-release --repo-url ntc0728/video-warehouse
  ```
  - 注意：因 `package.json`/CHANGELOG/manifest 已是某一版本，release-please 不会重复算版，而是把这次当作「完成该版本发布」；若它判定已发布而未生成 GitHub Release，可直接基于现有 `vX.Y.Z` tag 在 GitHub 手动建 Release，内容用 `CHANGELOG.md` 对应段落即可。
  - 陈旧分支 `release-please--branches--master` 若残留，先 `git push origin --delete release-please--branches--master` 再重跑，避免重开过期 PR。

### 3. 双端版本同步（Capacitor Android）

- 脚本 `scripts/sync-capacitor-version.mjs` 在 `build:android` 时从 `package.json` 读 SemVer，写入 `capacitor.config.ts` 的 `version`（含通道）并派生 `android.versionCode`。
- **versionCode 公式**：`major*100000 + minor*1000 + patch*10 + 通道序`（release=3 / rc=2 / beta=1 / alpha=0），保证 `rc < 正式`、跨版本严格递增，且要求 `patch < 100`。
- 独立命令：`npm run sync:capacitor-version`。

### 4. 应用内展示

- 设置页「关于」标签（`src/pages/Settings/tabs/AboutTab.tsx`）从 `package.json` 动态读取版本号，并显示 `平台 · 通道`（Web/Android × 正式版/开发版，靠 `import.meta.env.CAPACITOR` / `DEV` 判断）。
- 「更新日志」入口（`ChangelogContent.tsx`）渲染仓库根 `CHANGELOG.md`（release-please 自动维护）。
- 架构决策见 `docs/KNOWLEDGE.md` ADR-004；改动留痕见 `changelogs/`。



