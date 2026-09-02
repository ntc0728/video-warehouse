/**
 * 播放页右侧侧栏骨架占位：模拟 CMS 源 / 选季 / 选集 三个面板的结构。
 * 入场加载阶段（video 未就绪 / cmsLoading）显示，数据就绪后由主分支渲染真实面板。
 * 视觉复用项目级 --color-skeleton / --color-skeleton-shine + shimmer 扫光（明暗主题已适配）。
 *
 * ⚠️ 结构必须与真实面板逐层同构（同一套 .player-panel / .player-panel-header /
 *    .player-panel-body 类），外层 .player-sidebar-skeleton 用 display:contents
 *    把这三个面板直接变成 .player-sidebar 的 flex 子项 —— 于是骨架与真实面板：
 *    - 内边距 / 边框 / scrollbar-gutter 完全一致（无横向抖动）；
 *    - 高度由 tv(2:4:4) / movie(3:7) 变体比例分配，骨架阶段就是最终高度（无纵向跳动）。
 *    行数取 2/6/6，密度贴近真实面板。
 */
interface PlayerSidebarSkeletonProps {
  /** 与 PlayerSidebar 同变体："tv"=有选季面板（3 个骨架），"movie"=无选季面板（2 个骨架） */
  variant?: 'tv' | 'movie';
}

export function PlayerSidebarSkeleton({ variant = 'tv' }: PlayerSidebarSkeletonProps) {
  // 三个面板行数：
  //   - CMS 源：2 行
  //   - 选季：6 行
  //   - 选集：PAGE_SIZE=12，桌面端 2 列 → 6 行
  const panels = [
    { key: 'cms', mod: 'player-panel--cms', rows: 2 },
    { key: 'season', mod: 'player-panel--season', rows: 6 },
    { key: 'episodes', mod: 'player-panel--episodes', rows: 6 },
  ].filter((p) => variant === 'tv' || p.key !== 'season');

  return (
    <div className="player-sidebar-skeleton" aria-hidden="true">
      {panels.map(({ key, mod, rows }) => (
        <div className={`player-panel ${mod}`} key={key}>
          <div className="player-panel-header">
            <span className="player-skeleton-block player-skeleton-block--icon" />
            <span className="player-skeleton-block player-skeleton-block--title" />
            <span className="player-panel-info">
              <span className="player-skeleton-block player-skeleton-block--info" />
            </span>
          </div>
          <div className="player-panel-body">
            <div className="player-skeleton-rows">
              {Array.from({ length: rows }).map((_, i) => (
                <div className="player-skeleton-row" key={i}>
                  <span className="player-skeleton-block player-skeleton-block--thumb" />
                  <span className="player-skeleton-block player-skeleton-block--line" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
