---
date: 2026-09-12
module: pages/Browse
type: feature
build: vite build EXIT=0 (20.26s)
files:
  - src/pages/Browse/useBrowseData.ts
  - src/pages/Browse/useCMSSearch.ts
  - src/pages/Browse/BrowsePagination.tsx
  - src/pages/Browse/Browse.css
  - src/pages/Browse/index.tsx
demo: playwright 实测（注入 token + mock api.tmdb.org 分页数据）
---

# Browse 右栏：无限滚动 → 分页切换 + 左栏 sticky（2026-09-12 用户三问三答拍板）

## 决策记录（AskUserQuestion 三问）

1. **左栏滚动**：sticky 常驻（推翻 2026-09-07「去 sticky」拍板——其前提「页面无限长」因分页失效）
2. **分页形态**：numbered（TMDB 数字页码）+ simple（CMS 退化为上一页/下一页 + 第 N 页）
3. **翻页行为**：清空 + loading + 滚回顶部

## 旧 ↔ 新对照

| | 旧 | 新 |
| --- | --- | --- |
| 加载方式 | useInfiniteScroll（IO+scroll 兜底）追加式 | BrowsePagination 替换式 |
| CMS 语义 | loadMore 各源 page+1 追加 → 第 N 页 = 1~N 累积 | goToPage(n) 并发拉 pg=n 整体替换 |
| CMS 上一页 | 无（追加式无法回退） | 直接重拉 pg=n-1（MacCMS 天然支持任意页） |
| 左栏 | align-self:start 随页面滚（Browse.css:628） | position:sticky top:0 + max-height calc(100dvh - --header-height) + overflow-y:auto（独立规则块 `.browse-page .filter-bar`） |
| 翻页后滚动位置 | —（无限滚动无需处理） | handlePageChange 里 .app-shell__scroll.scrollTo({top:0, behavior:'smooth'}) |

## 关键实现细节

- **CMS 总页数不可知**：MacCMS 返回体只有 `total` 无 `limit/pagecount` → 算不出 totalPages，
  页码条无从渲染 → simple 形态；hasMore 退化为「本页有内容」（探测式）
- **CMS 渐进反馈保留**：slots 数组按 sourceIndices 落位（响应顺序不定、显示顺序稳定），
  首个源响应即收 loading，其余源后台继续补进当前页
- **TMDB goToPage**：search/fetchDiscover/fetchTopRated 均带 {reset:true} → store 同步清空旧结果
- **分页器 loading 时不消失**：条件用 showPagination（totalPages>1 / cmsPage>1||cmsHasMore），
  不依赖 results.length（否则翻页瞬间消失造成布局跳动）；disabled = showResultsLoading||loading
- **sticky 独立规则块**：与既有 .filter-bar 块混排会连环触发 stylelint order（position 早于
  grid-area、top 早于 align-self…），拆块 + `.browse-page` 前缀（同时避开 no-duplicate-selectors、
  收窄作用域不波及其他 FilterBar 调用方）
- **分页器视觉**：对齐 .browse-sort-bar__tab——常态无边框无底（token 收敛），激活主色底反白字；
  高度不写死（项目禁裸 px），min-width:2em + padding 决定
- **死代码**：BrowseLoadMore.tsx 无引用保留未删（等用户确认分页方案后一并清理）；
  useBrowseData.loadMore 未删（hook 内部，无副作用）

## 验证（playwright + 注入）

- **token 注入法**（照抄 scripts/global-setup.ts）：先 goto 触发初始化 → 等 2.5s →
  evaluate 写 localStorage['app-settings']（tmdbAccessToken 明文）→ 再写一次（写回风暴）→
  reload 让 persist rehydrate。dev 下 TMDB 请求本不发（无 token 时 fetchTMDB 直接 throw，
  连 request 事件都没有），注入后才发。
- route mock `**api.tmdb.org/3/discover/**` 返回 20 条/页 × total_pages=42
- PAGE1：分页器 `上一页 1 2 … 42 下一页`、active=1、hasP1=true、scrollH=1680 可滚
- 滚到底(840)点下一页 → PAGE2：active=2、**hasP1=false hasP2=true（替换非追加）**、
  **scrollTop=0（回顶生效）**；REQUESTED_PAGES=[1,1,2,2]（reload+双端点，正常）
- sticky：注入 2000px 高度后滚 500 → filter-bar y=113.9→**60**（= header 高度，贴 header 下沿）
- 截图确认：滚到底左栏完整可见、分页器居中、BackToTopButton 正常
- stylelint 15 条 = HEAD 基线零新增；tsc -b EXIT=0；vite build EXIT=0 (20.26s)
- E2E 无依赖检查：e2e/ 无 loadmore/sentinel/infinite 引用

## 待用户确认

- 未 commit、未 E2E（用户红线）
- BrowseLoadMore.tsx（死代码）待确认后删
