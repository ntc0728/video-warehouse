import { useMediaQuery, useIsTV } from './useMediaQuery';

/** HeroBili 右栏卡片列数（行数恒为 2，卡数 = 列数 × 2）。 */
export type HeroSideCols = 1 | 2 | 3;

/**
 * HeroBili 右栏竖版卡列数（2026-09-10 用户拍板的分档）。
 *
 * 背景：右栏宽度 = `--hero-side-w` ≈ 内容宽 × 56%。在 1024–1280 区间，
 * 3 列会让单卡过窄、封面与标题都挤 → 用户要求按视口分档降列（不跨列、纯矩形）：
 *
 *   · vw ≤ 1023        → **2 列**（4 张，移动端布局；CSS `@media (width <= 1023px)` 管）
 *   · 1024 ≤ vw ≤ 1280 → **2 列**（4 张）
 *   · vw ≥ 1281        → **3 列**（6 张，基础形态）
 *
 * ⚠️ 2026-09-10 第七轮修正：**删去原 1024–1152 的 1 列档**。根因：卡片封面持
 * `aspect-ratio: 16/9` 后卡高由列宽派生，1 列会让单卡宽达 685–813px → 2 行卡片
 * 总高 837–981px，远超任何合理 banner 高度（实测需把 banner 拉到 0.88:1 = 竖条），
 * 即「降列数」与「封面保持比例」在 1 列下数学上不可共存。改为 1024–1280 统一 2 列：
 * banner 得以保持 1.65–1.68:1 的正常横幅形状。
 *
 * ⚠️ 本 hook 是**列数唯一 JS 真源**，CSS 侧的 `grid-template-columns` 必须按同一批
 * 断点（1280/1281）同步，否则卡片数与网格列数不一致会出现空槽或换行。
 * TV 端恒返回 3（TV 不渲染本组件，仅保持语义稳定）。
 */
export function useHeroSideCols(): HeroSideCols {
  const isTV = useIsTV();
  // 顺序固定（Hook 不能条件调用），三段媒体查询互斥
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const isCol2 = useMediaQuery('(min-width: 1024px) and (max-width: 1280px)');
  if (isTV) return 3;
  if (isCol2) return 2;
  if (isNarrow) return 2;
  return 3;
}
