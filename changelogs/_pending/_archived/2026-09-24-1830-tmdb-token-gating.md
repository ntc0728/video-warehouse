---
date: 2026-09-24
module: TMDB token gate
type: 功能（未配置 token 全站适配）
build: ✅ npm run build 通过
files:
  - src/hooks/useHasTmdbToken.ts
  - src/hooks/index.ts
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/SearchBox/SearchBox.tsx
  - src/pages/Browse/index.tsx
  - src/pages/Browse/Browse.css
  - src/pages/Detail/index.tsx
  - src/pages/Person/index.tsx
  - src/pages/Player/hooks/useCMSSourceManager.ts
demo: 无
---

# TMDB Access Token 未配置全站适配

## 旧逻辑 → 新逻辑

新增 `useHasTmdbToken()` 统一判定（读 `useSettingsStore.tmdbAccessToken` trim 后非空），各处按需短路/展示 `TokenRequired`：

| 位置 | 门控 |
| --- | --- |
| `useWideCategoryPanel` genre 子分类加载 | `!hasToken` 跳过请求 |
| `useWideCategoryPanel` 面板内容拉取 | `!hasToken` 跳过请求 |
| SearchBox 热门搜索（trending 拉取 + 展示） | `!hasToken` 不拉不展示 |
| SearchBox 实时建议（searchMulti） | `!hasToken` 置 idle 清空 |
| Browse `fetchGenresAndCountries` | `!hasToken` 跳过 |
| Browse 智能检索结果区 | `!hasToken` 整块 `<TokenRequired />` |
| Detail `useLayoutEffect` TMDB 加载 | `tmdb-` + `!hasToken` 提前置 loading=false 不发请求（render 层已有 TokenRequired） |
| Person `loadPerson` | `!token` 直接 return 不发请求 |
| Person `useLayoutEffect` | `!hasToken` 不触发 loadPerson |
| Person render | `!hasToken` 整页 `<TokenRequired />` |
| `useCMSSourceManager` TMDB 详情加载 | `!token` 短路不发请求 |

## 不改

Home（已有 hasToken + home-token-required）、Detail/Player render 层 TokenRequired（已有）。

## 验证

- `npm run build` ✅
