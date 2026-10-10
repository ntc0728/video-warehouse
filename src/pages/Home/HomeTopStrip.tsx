/**
 * HomeTopStrip — 首页顶部过渡带（2026-09-10 大屏整改补强之二）
 *
 * 位置：StickyHeader 与 HeroBanner 之间，仅在宽屏桌面（≥1024，与 HeroBili 同条件）渲染。
 *
 * 2026-10-09（用户需求，取代同日早先的「数据源状态」方案）：
 * 公告位改为**当前热度 Top20 轮播** —— useTMDBStore.trending 按 popularity 降序
 * 取前 20 条，单条显示，5s 自动切换，纵向（上下）滑动动画。
 * 每条格式：热度值 + 标题 + 年份 + 类型(电影/剧集) + 评分。
 * trending 为空时该位不渲染（右侧个人内容 pill 不受影响）。
 *
 * 首项文案：类名 home-topstrip__crumb 沿用旧名（语义已是「公告」标签）。
 *
 * 视觉：通栏底色 + 底边框，内容宽度与 `.home-page__content` 同为 2200 封顶居中
 *       （与「顶栏对齐」补强同一契约）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Star } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import type { TMDBVideoItem } from '@/types/tmdb';

interface HomeTopStripProps {
  /** 「继续观看」条数（0 则该 pill 不渲染） */
  continueCount: number;
  /** 收藏条数（0 则该 pill 不渲染） */
  favoriteCount: number;
  /** TMDB trending 列表（热度轮播数据源，内部按 popularity 降序取 Top20） */
  trending: TMDBVideoItem[];
}

/** 轮播间隔（用户指定 5s） */
const ROTATE_INTERVAL_MS = 5000;

/** 热度值显示：≥100 取整（TMDB popularity 上不封顶），<100 保留 1 位小数 */
function formatHeat(popularity: number): string {
  return popularity >= 100 ? Math.round(popularity).toString() : popularity.toFixed(1);
}

export default function HomeTopStrip({ continueCount, favoriteCount, trending }: HomeTopStripProps) {
  // 热度 Top20（用户需求 2026-10-09）：popularity 降序，轮播池
  const heatTop20 = useMemo(
    () => [...trending].sort((a, b) => b.popularity - a.popularity).slice(0, 20),
    [trending],
  );
  const [heatIndex, setHeatIndex] = useState(0);

  // 5s 自动轮换（上下切换）：数据集变化时归零重建定时器
  useEffect(() => {
    setHeatIndex(0);
    if (heatTop20.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeatIndex((i) => (i + 1) % heatTop20.length);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [heatTop20]);

  return (
    <div className="home-topstrip">
      <div className="home-topstrip__inner">
        <span className="home-topstrip__crumb">今日热度趋势</span>
        {heatTop20.length > 0 && (
          <div className="home-topstrip__rotator" role="status" aria-label="今日热度趋势">
            <div
              className="home-topstrip__rotator-track"
              /* 位移 = 条数 × 单条高（--rotator-h 定义在 Home.css .home-topstrip__rotator）。
                 禁用 translateY(-N%)：百分比相对 track 自身总高（N 条堆叠），
                 N% 一步会跳出整屏（2026-10-10 用户报「漂移后空白」根因）。 */
              style={{ transform: `translateY(calc(-${heatIndex} * var(--rotator-h)))` }}
            >
              {heatTop20.map((item) => (
                <Link
                  key={item.id}
                  to={`/detail/${item.id}`}
                  state={{ from: '/' }}
                  className="home-topstrip__rotator-item"
                  aria-label={`查看 ${item.title} 详情`}
                >
                  {/* 热度/评分样式参考 chart 页 card（Chart.css .chart-row__heat .n/.v）：
                     热度 = 暖橙 --color-warning-text 加粗 + Flame，评分 = 次级色 + Star，
                     数字 tabular-nums（配色口径 2026-10-10 用户指定） */}
                  <span className="home-topstrip__heat">
                    <Icon icon={Flame} size="xs" />
                    {formatHeat(item.popularity)}
                  </span>
                  <span className="home-topstrip__heat-title">{item.title}</span>
                  {/* 年份/类型 = 胶囊（镜像 chart-row__badge：tag-bg + radius-sm） */}
                  {item.year != null && <span className="home-topstrip__meta">{item.year}</span>}
                  <span className="home-topstrip__meta">{item.mediaType === 'tv' ? '剧集' : '电影'}</span>
                  {item.voteAverage > 0 && (
                    <span className="home-topstrip__score">
                      <Icon icon={Star} size="xs" />
                      {item.voteAverage.toFixed(1)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="home-topstrip__right">
          {continueCount > 0 && (
            <Link to="/history" className="home-topstrip__pill" aria-label="前往历史（继续观看）">继续观看 {continueCount}</Link>
          )}
          {favoriteCount > 0 && (
            <Link to="/collections" className="home-topstrip__pill" aria-label="前往收藏">收藏 {favoriteCount}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
