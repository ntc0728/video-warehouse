# Changelog

本文件由 [release-please](https://github.com/googleapis/release-please) 依据 **Conventional Commits** 自动维护。

## 版本规则（SemVer）

- **MAJOR（X）** — 破坏性变更
- **MINOR（Y）** — 新增功能（0.x 阶段破坏性变更也升 MINOR）
- **PATCH（Z）** — 修复 / 样式 / 重构
- 预发布通道：`-alpha.N` / `-beta.N` / `-rc.N`

> 首次自动发布（合并 release-please 开版 PR）后，上方占位内容将被实际变更记录取代。

## 当前状态

- `package.json` 版本：`0.0.0`（尚未发布首个稳定版）
- Android 端 `versionCode` 由 `scripts/sync-capacitor-version.mjs` 在 `build:android` 时从版本号自动派生
