/**
 * 播放页右侧侧栏骨架占位：模拟 CMS 源 / 选季 / 选集 三个面板的结构。
 * 入场加载阶段（video 未就绪 / cmsLoading）显示，数据就绪后由主分支渲染真实面板。
 * 视觉复用项目级 --color-skeleton / --color-skeleton-shine + shimmer 扫光（明暗主题已适配）。
 */
export function PlayerSidebarSkeleton() {
  // 三个面板：CMS 源（4 行）、选季（3 行）、选集（6 行），行数贴近真实面板密度
  const rows = [4, 3, 6];
  return (
    <div className="player-sidebar-skeleton" aria-hidden="true">
      {rows.map((count, panelIdx) => (
        <div className="player-skeleton-panel" key={panelIdx}>
          <div className="player-skeleton-panel__head">
            <span className="player-skeleton-block player-skeleton-block--icon" />
            <span className="player-skeleton-block player-skeleton-block--title" />
          </div>
          <div className="player-skeleton-panel__body">
            {Array.from({ length: count }).map((_, i) => (
              <div className="player-skeleton-row" key={i}>
                <span className="player-skeleton-block player-skeleton-block--thumb" />
                <span className="player-skeleton-block player-skeleton-block--line" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
