# Brief: React 轮播图组件选型

## Refined question
为 React 18 + TypeScript + Vite 视频播放器项目（video-warehouse）选择最合适的轮播图组件，替换当前使用的 Swiper v14。

## Scope boundaries
- **In**: React 生态的轮播图组件对比、性能、功能、包大小、维护状态
- **In**: 当前 HeroBanner 的核心需求（autoplay、loop、触摸、键盘导航、响应式、分页点、箭头）
- **Out**: 非 React 组件、服务端渲染方案、商业付费组件
- **Out**: 移动端原生轮播（Capacitor WebView 内运行）

## Assumptions
- 目标环境：现代浏览器（Chrome 90+、Safari 15+、Firefox 90+）+ Capacitor Android WebView
- 需要支持触摸滑动、键盘导航、自动播放、暂停交互
- 包大小敏感（视频播放器应用，需要控制首屏加载）
- 需要良好的 TypeScript 类型支持
- 当前使用 Tailwind CSS + 自定义 CSS

## Depth mode
standard

## Date
2026-07-11

## Angles
1. Embla Carousel — 轻量级、现代、无依赖轮播方案评估
2. Swiper v14 现状 — 是否值得留在 Swiper（最新改进、已知问题、社区反馈）
3. 其他主流 React 轮播方案 — react-slick、react-responsive-carousel、Framer Motion 方案等
4. 性能与包大小对比 — 各方案的实际 bundle size、渲染性能、内存占用数据
5. 实际项目经验与社区反馈 — GitHub issues、Stack Overflow、开发者评价
