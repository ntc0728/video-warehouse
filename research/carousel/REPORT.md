# React 轮播图组件选型调研

> Generated 2026-07-11 · depth: standard · 40+ findings · workspace: research/carousel/

## Executive summary

- **推荐方案：Embla Carousel** — 7.3KB gzipped（仅为 Swiper 的 1/4），零 CSS 依赖，原生 React 18 支持，Fade 插件天然适配 hero banner 场景 [1][4][5]。年下载量 744M，是 Swiper 的 4.4 倍；仅 6 个 open issues [9]
- **Swiper v14 仍然优秀**：刚完成 TypeScript 重写，零运行时依赖，功能最全，但包大小（JS+CSS ~28-30KB gzipped）是 Embla 的 4 倍，且存在活跃的 CVE-2026-27212 原型污染漏洞（修复不完整）[2][3][5][9]
- **react-slick 不推荐**：418 个 open issues，73 个 open PRs，与 Vite 8/Rolldown 不兼容，存在 `offsetWidth` 性能问题 [9]
- **react-responsive-carousel 已废弃**：维护者 4 年未更新，不推荐新项目使用 [3]
- **Framer Motion 不是轮播方案**：仅提供动画原语，需从零构建轮播 [3]

## Background & scope

项目为 React 18 + TypeScript + Vite 视频播放器应用，当前使用 Swiper v14 实现首页 Hero Banner 轮播。核心需求：autoplay、loop、触摸滑动、键盘导航、分页指示点、响应式（含 Capacitor Android WebView）。目标是选择最适合的轮播组件替换或确认当前方案。

## 方案对比

| 维度 | Embla Carousel | Swiper v14 | react-slick | react-responsive-carousel |
|------|---------------|------------|-------------|--------------------------|
| JS 包大小 (gzip) | **7.3KB** | 19.6KB | 15.7KB | 9.3KB |
| CSS 依赖 | **零** | ~8-12KB | 零 | 零 |
| 总计估算 (gzip) | **~7.3KB** | ~28-30KB | ~15.7KB+deps | ~9.3KB+deps |
| 运行时依赖数 | 2 (内部) | **0** | 6 | 3 |
| sideEffects | **false** | true | — | — |
| TypeScript 支持 | 内置 | v14 源码生成 | 有问题 (#2404) | wontfix |
| React 18 兼容 | peerDeps 明确支持 | 一等支持 | 已合并但类型问题 | 未验证 |
| Autoplay 插件 | **1.1KB gzip** | 内置模块 | 内置 | 内置 |
| Fade/交叉渐变 | **Fade 插件** | effect: 'fade' | fade=true | 支持 |
| 键盘导航 | Accessibility 插件 | Keyboard 模块 | accessibility prop | 内置 |
| 触摸手势 | 内置 | 内置 | swipe prop | 内置 |
| 维护状态 | **活跃** (v9 RC) | **活跃** (v14.0.5) | 活跃 | **已废弃** |
| 周下载量 | **31M** | 2.85M | — | 622K |
| 年下载量 | **744M** | 170M | 69M | — |
| GitHub open issues | **6** | 236 | 418 | — |
| GitHub Stars | — | 11.9k | 11.9k | 2.7k |
| 头部/无 UI 架构 | **是** | 否 (内置 UI) | 否 | 否 |
| 安全问题 | 无 | CVE-2026-27212 | — | — |

## 分析

### Embla Carousel 的优势

Embla 是 headless 架构 — 只提供轮播引擎（滚动物理、对齐、snapping），UI 层（箭头、分页点）由开发者自由实现 [8]。这恰好匹配当前 HeroBanner 的架构：Swiper 只负责 slide 容器，内容层和分页点都是自定义组件。

关键优势：
- **包大小领先**：7.3KB gzipped vs Swiper 的 ~28-30KB（含 CSS），减少约 75% [1][5]
- **零 CSS 依赖**：无需 `import 'swiper/css'`，样式完全由开发者控制 [5]
- **sideEffects: false**：Vite/esbuild 可完全 tree-shake [5]
- **Autoplay 插件仅 1.1KB**：模块化成本极低 [5]
- **Fade 插件**：hero banner 场景天然需要交叉渐变，Embla 有专门的 Fade 插件 [4]

### Swiper v14 的优势

Swiper 刚在 2026 年 6 月完成 TypeScript 重写（v14），解决了长期的类型漂移问题 [2]：
- 类型从源码生成，不可能与实现不同步
- 零运行时依赖（移除了 ssr-window）
- 功能最全：虚拟 slide、history API、FreeMode、Coverflow 等
- 2.85M 周下载量，生态最成熟

### 社区健康度对比

- **Embla**: 年下载量 744M（第 1），仅 6 个 open issues，代码质量最高 [9]
- **Swiper**: 年下载量 170M（第 2），236 个 open issues，有活跃 CVE（CVE-2026-27212 原型污染，修复不完整）[9]
- **react-slick**: 年下载量 69M（第 3），418 个 open issues + 73 个 open PRs，与 Vite 8/Rolldown 不兼容，`offsetWidth` 读取导致性能问题 [9]

### 迁移成本评估

从 Swiper 迁移到 Embla 需要：
1. 替换 `Swiper`/`SwiperSlide` 为 `useEmblaCarousel` hook + 手动渲染 slides
2. 重新实现分页点和箭头按钮（当前已是自定义组件，迁移成本低）
3. 使用 Embla 的 Autoplay 和 Fade 插件替换 Swiper modules
4. 移除 `swiper/css` 导入

当前 HeroBanner 的架构（内容层和分页点都是独立组件）使得迁移相对简单 — 核心改动集中在 Swiper → Embla 的容器替换。

## Open questions

1. Embla Carousel v9 RC (9.0.0-rc02) 已在进行中，是否等待稳定版再迁移？
2. Embla 的 Fade 插件在 React 18 Concurrent Mode 下是否有已知问题？
3. Capacitor Android WebView 中 Embla 的触摸手势表现如何？需实测验证。

## Sources

[1] Embla Carousel React — https://www.npmjs.com/package/embla-carousel-react (accessed 2026-07-11)
[2] Swiper v14 Blog Post — https://swiperjs.com/blog/swiper-v14 (published 2026-06-26, accessed 2026-07-11)
[3] React Carousel Libraries Comparison — GitHub issues & npm pages (accessed 2026-07-11)
[4] Embla Carousel Official Site — https://www.embla-carousel.com/ (accessed 2026-07-11)
[5] Bundlephobia API — https://bundlephobia.com/api/size?package=* (accessed 2026-07-11)
[6] Swiper React Docs — https://swiperjs.com/react/ (accessed 2026-07-11)
[7] Swiper vs Embla Comparison — https://swiperjs.com/compare/swiper-vs-embla-carousel (accessed 2026-07-11)
[8] Embla Carousel GitHub — https://github.com/davidjerleke/embla-carousel (accessed 2026-07-11)
[9] npm Downloads & GitHub Issues — https://api.npmjs.org/downloads/point/last-year/* & GitHub repos (accessed 2026-07-11)
