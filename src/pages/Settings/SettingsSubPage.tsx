/**
 * SettingsSubPage — 设置页移动端子页面
 *
 * 全屏覆盖视口（含全局顶部导航栏区域）：
 *   - 子页容器 position: fixed; inset: 0（CSS 中），z-index 高于 sticky-header，
 *     顶栏（返回 + 标题）固定在视口顶部、与全局导航栏同高 —— 视觉上替代导航栏；
 *   - body 在顶栏下方独立滚动；
 *   - 支持触摸右滑（>80px）返回上一级。
 * 仅在移动端（≤767px）使用（桌面端不渲染 SubPage，直接内联 tab 内容）。
 */
import { useEffect, useRef, type ReactNode } from 'react';
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

  const label = SETTINGS_TABS.find(t => t.key === tab)?.label || tab;

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
      if (diff > 80) onBack();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onBack]);

  return (
    <div ref={containerRef} className="settings-subpage">
      <div className="settings-subpage__header">
        <button
          type="button"
          className="back-btn"
          onClick={onBack}
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
    </div>
  );
}
