/**
 * SettingsSubPage — 设置页移动端子页面
 *
 * 全屏覆盖视口（含全局顶部导航栏区域）：
 *   - 通过 createPortal 挂到 document.body，脱离滚动容器 `.app-shell__scroll`
 *     （其 `contain: layout` 会作为 fixed 后代的包含块，导致 fixed 相对滚动容器
 *     定位、无法覆盖导航栏）；子页容器 position: fixed; inset: 0，
 *     z-index 高于 sticky-header，顶栏（返回 + 标题）固定在视口顶部、
 *     与全局导航栏同高 —— 视觉上替代导航栏；
 *   - body 在顶栏下方独立滚动；
 *   - 支持触摸右滑（>80px）返回上一级。
 * 仅在移动端（≤767px）使用（桌面端不渲染 SubPage，直接内联 tab 内容）。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { SETTINGS_TABS } from './SettingsTabBar';
import type { SettingsTabKey } from './SettingsTabBar';
import { Icon } from "@/components/ui/Icon";

interface SettingsSubPageProps {
  tab: SettingsTabKey;
  onBack: () => void;
  children: ReactNode;
}

export default function SettingsSubPage({ tab, onBack, children }: SettingsSubPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const isDragging = useRef(false);
  // 退出动画状态：触发后加 .settings-subpage--leaving，animationend（或 500ms 兜底）后回调 onBack
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = SETTINGS_TABS.find(t => t.key === tab)?.label || tab;

  /** 统一退出入口：播放退出动画后回调 onBack（返回按钮 / 触摸右滑共用） */
  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // 标记 body：触发下方菜单视差归位（与子页右滑同步），强化「返回」层级感
    document.body.classList.add('settings-subpage--closing');
    setLeaving(true);
    // animationend 兜底：动画被禁用/异常时保证不卡死在子页
    leaveTimerRef.current = setTimeout(onBack, 500);
  }, [onBack]);

  useEffect(() => () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    // 异常卸载（如路由直接切走）时清掉 body 标记，避免残留影响其它页
    document.body.classList.remove('settings-subpage--closing');
  }, []);

  // 仅退出动画（--leaving）结束才回调；进入动画的 animationend 忽略。
  // 必须校验 e.target 为容器自身：animationend 会冒泡，后代元素动画结束
  // 也会被此处捕获，若不过滤会在离场途中误触发 onBack 导致子页提前卸载。
  const handleAnimationEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== containerRef.current) return;
    if (!leavingRef.current) return;
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    document.body.classList.remove('settings-subpage--closing');
    onBack();
  }, [onBack]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      isDragging.current = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const diff = e.changedTouches[0].clientX - startXRef.current;
      if (diff > 80) leave();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [leave]);

  return createPortal(
    <div
      ref={containerRef}
      className={`settings-subpage${leaving ? ' settings-subpage--leaving' : ''}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="settings-subpage__header">
        <button
          type="button"
          className="back-btn"
          onClick={leave}
          aria-label="返回"
        >
          <Icon icon={ArrowLeft} size="lg" />
        </button>
        <h2 className="settings-subpage__title">{label}</h2>
        {/* 右侧占位按钮：保持标题居中（与 iOS 导航栏左返回右菜单的对称结构） */}
        <span className="settings-subpage__header-spacer" aria-hidden="true" />
      </div>
      <div className="settings-subpage__body">
        {children}
      </div>
    </div>,
    document.body,
  );
}
