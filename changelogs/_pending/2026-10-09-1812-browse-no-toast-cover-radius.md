# 2026-10-09 18:12 Browse 去 toast 提示 + video card 封面圆角

## 用户需求
① Browse 页「加载失败，请检查网络后重试」toast 不应显示；② Browse 页 video card 缺少圆角。

## 改动
- `src/pages/Browse/index.tsx`：runGoto catch 块删除 toast.error + lastErrorToastRef 节流戳（失败态由结果区 Empty「加载失败」承担，2026-10-10 用户拍板页内不叠加浮层提示）；删 `import { toast } from '@/components/ui'`。`endRefresh()` 收尾保留（loading 不永驻）。
- `src/pages/Browse/Browse.css`：补封面圆角（与收藏/历史页 10-09 同款）：`@media (width>=768px)` 非 app/tv 档 `.browse-page .video-card-cover { border-radius: var(--radius-md) }`——2026-09-28 去卡片化削掉卡容器 radius 后（VideoCard.css:98）在此恢复；≤767/app 卡容器自带圆角无需补。

## 验证
stylelint ✓ / tsc ✓ / eslint ✓ / vite build ✓ / 产物断言 ✓（18:11 代次：Browse 分包 CSS index-BIAOLIRU.css 含圆角规则；入口 index-CYsXIwkY.js 无 toast 文案——dist 里其余 19 个含该文案的 index-*.js 全是 --emptyOutDir false 累积的旧代次）。未 commit、未 E2E。
