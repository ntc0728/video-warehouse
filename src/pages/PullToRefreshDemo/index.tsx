import { useCallback, useMemo, useRef, useState } from 'react';
import { usePullPhase, usePullToRefresh } from '@/components/ui/PullToRefresh';
import './PullToRefreshDemo.css';

interface DemoItem {
  id: number;
  title: string;
  meta: string;
  hue: number;
}

const SAMPLE = [
  '星际穿越', '盗梦空间', '银翼杀手 2049', '沙丘', '教父', '低俗小说',
  '千与千寻', '瞬息全宇宙', '寄生虫', '爆裂鼓手', '降临', '她的',
  '海上钢琴师', '楚门的世界', '这个杀手不太冷',
];

function makeItems(): DemoItem[] {
  return SAMPLE.map((title, i) => ({
    id: Date.now() + i,
    title,
    meta: `${2010 + (i % 14)} · ${['科幻', '剧情', '悬疑', '动画', '动作'][i % 5]} · ${(6.5 + ((i * 0.3) % 3.4)).toFixed(1)} 分`,
    hue: (i * 47) % 360,
  }));
}

const PHASE_LABEL: Record<string, string> = {
  idle: '空闲',
  pulling: '下拉中',
  armed: '可松手',
  refreshing: '刷新中',
  success: '已刷新',
};

/**
 * 下拉刷新 Demo（浮层模型示例）
 *
 * 本页不包裹任何 <PullToRefresh> 容器——全局浮层挂载于 AppLayout，
 * 页面仅通过 usePullToRefresh 钩子注册刷新回调（零 DOM 注入）。
 * 在列表顶部向下拖动即可触发；页面内容不会跟随下移。
 * 顶部提供「顶部指示 / 中间按钮」两种视觉变体切换，供确认组件手感。
 */
export default function PullToRefreshDemo() {
  const [items, setItems] = useState<DemoItem[]>(() => makeItems());
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [variant, setVariant] = useState<'default' | 'settings'>('default');
  const refreshingRef = useRef(false);

  // 浮层实时阶段（供 Demo 回显，真实页面可用来做「刷新中禁用交互」等联动）
  const { phase, pull } = usePullPhase();

  const handleRefresh = useCallback((): Promise<void> => {
    if (refreshingRef.current) return Promise.resolve();
    refreshingRef.current = true;
    setRefreshing(true);
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        setItems(() => makeItems());
        setLastRefresh(new Date());
        refreshingRef.current = false;
        setRefreshing(false);
        resolve();
      }, 1200);
    });
  }, []);

  // 注册到全局浮层：页面本身不新增任何元素
  usePullToRefresh(handleRefresh, {
    enabled: !disabled,
    meta: () => '示例数据',
    variant,
  });

  const progressText = useMemo(
    () => (refreshing ? '刷新中…' : `最后刷新 ${lastRefresh.toLocaleTimeString('zh-CN', { hour12: false })}`),
    [refreshing, lastRefresh],
  );

  const tip =
    variant === 'settings'
      ? '设置页风格：在列表顶部向下拖动，页面中间会位移浮现圆形刷新按钮，越过阈值松手即触发。'
      : 'B 站同款小电视：在列表顶部向下拖动（移动端手指 / 桌面按住鼠标下拉），耳朵随进度竖起、达标冒电波、松手后摇摆加载；页面内容不会跟随下移。';

  return (
    <div className="ptr-demo">
      <header className="ptr-demo__bar">
        <div className="ptr-demo__heading">
          <span className="ptr-demo__title">下拉刷新 · 浮层 Demo</span>
          <span className="ptr-demo__sub">全局浮层接管手势，页面零新增元素</span>
        </div>
        <div className="ptr-demo__controls">
          <div className="ptr-demo__seg" role="group" aria-label="指示器样式">
            <button
              type="button"
              className={variant === 'default' ? 'is-on' : ''}
              onClick={() => setVariant('default')}
            >
              顶部指示
            </button>
            <button
              type="button"
              className={variant === 'settings' ? 'is-on' : ''}
              onClick={() => setVariant('settings')}
            >
              中间按钮
            </button>
          </div>
          <button
            type="button"
            className="ptr-demo__action"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            {refreshing ? '刷新中…' : '直接刷新'}
          </button>
          <label className="ptr-demo__toggle">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
            <span>禁用刷新</span>
          </label>
        </div>
      </header>

      <div className="ptr-demo__status">
        <span className={`ptr-demo__badge ptr-demo__badge--${phase}`}>
          {PHASE_LABEL[phase] ?? phase}
        </span>
        <span className="ptr-demo__meta">{progressText}</span>
        <span className="ptr-demo__meta">
          位移 {Math.round(pull)}px · 阈值 52px
        </span>
      </div>

      <div className="ptr-demo__list">
        {items.map((it) => (
          <article className="ptr-demo__card" key={it.id}>
            <div
              className="ptr-demo__poster"
              style={{
                background: `linear-gradient(135deg, hsl(${it.hue} 70% 55%), hsl(${(it.hue + 40) % 360} 70% 40%))`,
              }}
            >
              <span className="ptr-demo__poster-title">{it.title}</span>
            </div>
            <div className="ptr-demo__info">
              <h3 className="ptr-demo__name">{it.title}</h3>
              <p className="ptr-demo__desc">{it.meta}</p>
            </div>
          </article>
        ))}
        <p className="ptr-demo__tip">{tip}</p>
      </div>
    </div>
  );
}
