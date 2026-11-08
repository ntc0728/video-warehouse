/** HeroBili 右栏卡片列数。 */
export type HeroSideCols = 2;
/** HeroBili 右栏卡片行数（全档 3 行）。 */
export type HeroSideRows = 3;

/**
 * HeroBili 右栏行数 —— 与列数同源、全档恒定。
 *
 * 左右视觉 6:4 + banner/单卡双 16:9 + 下沿齐平 ⇒ 行列满足 `R = 1.5 × C`，
 * 最小整数解为 C=2 / R=3（6 张）。比例与视口宽度无关，故 ≥1024 全档统一，
 * 不再按 2560 升列/增行；gap 只通过 layout-tokens.css 的右栏宽补偿公式消化。
 *
 * 本组件在 TV / <1024 不渲染（HeroBanner 分流到 Classic），故无需媒体查询。
 */
export function useHeroSideRows(): HeroSideRows {
  return 3;
}

/**
 * HeroBili 右栏横版卡列数。
 *
 * 旧分档（<2560 = 2×2 / ≥2560 = 3×3）已废：3×3 会把 banner 拉成 2.03:1，
 * 与「banner 尽量保持 16:9」冲突。现 ≥1024 全档 2 列 × 3 行 = 6 张，
 * 与 CSS 的 `grid-template-columns/rows` 及 layout-tokens 公式严格一致。
 *
 * ⚠️ 本 hook 是**列数唯一 JS 真源**，CSS 侧断点必须同步；否则卡片数与
 * 网格列数不一致会出现空槽或换行。
 */
export function useHeroSideCols(): HeroSideCols {
  return 2;
}
