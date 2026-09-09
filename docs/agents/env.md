# 开发命令与环境

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## 开发命令

```bash
npm run dev          # 开发服务器 (127.0.0.1:3001)
npm run build        # 生产构建（tsc -b && vite build）
npm run lint:all     # ESLint + Stylelint
npm run test         # Vitest 单元测试
npx playwright test  # E2E 测试（TMDB Mock 默认启用，-RealApi 关闭）
```

> **⚠️ 代码修改后必须执行 `npm run build`**  
> 禁止用 `npx tsc --noEmit --skipLibCheck` 替代——`--skipLibCheck` 会跳过 `noUnusedLocals` 检查，导致未使用变量提交后 CI 构建失败。  
> 正确流程：修改代码 → `npm run build` 验证通过 → `git commit` → `git push`。

> **⚠️ 改动必须及时 commit，不要堆积在工作区**  
> 所有改动若不 commit，子代理或其他操作可以一键覆盖全部。每完成一个独立功能就立即 commit。

> **⚠️ 子代理操作前必须 commit 保护现有改动**  
> 子代理可能重写非指定文件。使用子代理前，先 `git stash` 或 commit 保护当前状态。

> **⚠️ CSS 检查必须 grep 所有 display:none 规则**  
> 恢复代码后必须用 `grep` 搜索所有 `display: none` / `visibility: hidden` 确认无遗漏，不能只看 git diff 标记。

> **⚠️ 不要在未逐行确认时声称"恢复完成"**  
> 只说"已验证的改动"，不说"全部恢复"。除非逐文件逐行确认过，否则用"大部分已恢复，待验证"。


