# 2026-10-09 18:00 首页「换一换」React 侧骨架镜像修复

## 用户质询
截图（1440 dev）：首页 hero 右上「换一换」骨架是一个小圆点，与真实按钮（icon + 竖排「换一换」文本的竖长胶囊）相差甚远。

## 根因
两套骨架不同步：
- boot-splash 侧 `.bs-shuffle` 2026-10-09 已按真实按钮逐项换算镜像（padding 9.5 / icon 条 17×17 / 文本条 14×37）；
- React 侧（数据加载接替显示）`Home/index.tsx` 只渲染空 span + `Home.css` `.home-skeleton-bili__shuffle` 给了 `display:block; width:var(--space-xl)`，把真实基类 `.hero-bili__shuffle` 的 flex 布局拍掉、又无内容无高 → 塌成小圆点。

## 修复
- `src/pages/Home/index.tsx`：骨架 span 补两根内容条（`__shuffle-icon` + `__shuffle-text`），结构与真实按钮（Icon svg + 竖排文本 span）同构，aria-hidden。
- `src/pages/Home/Home.css`：删塌陷规则；新增两条内容条规则——icon 条 = `var(--icon-sm)`，文本条 = `calc(var(--text-2xs)*1.3) × calc(var(--text-2xs)*3.4)`（≈14×37，与 boot-splash 同换算口径）。盒模型（absolute 浮层定位/padding/border/flex-column/gap）全部继承真实基类，后续真实按钮改动骨架自动跟随。

## 验证
stylelint ✓ / tsc ✓ / vite build ✓ / 产物断言 ✓（17:59 代次 HomeRoute-DA85OGpw.css 含两条内容条规则、旧塌陷规则已清；HomeRoute-C1Bwmn2V.js 含新结构）。未 commit、未 E2E。
