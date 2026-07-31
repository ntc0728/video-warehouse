/**
 * SettingsSubPage — 设置页移动端子页面
 *
 * 顶部有返回按钮（通用 .back-btn 样式）+ 标题，body 渲染对应 tab 内容；
 * 支持触摸右滑（>80px）返回上一级
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
      </div>
      <div className="settings-subpage__body">
        {children}
      </div>
    </div>
  );
}
