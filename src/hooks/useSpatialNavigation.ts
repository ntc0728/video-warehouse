import { useEffect } from 'react';

export function useSpatialNavigation(options: {
  containerRef: React.RefObject<HTMLElement | null>;
  selector?: string;
  isTV?: boolean;
}): void {
  const { containerRef, selector = '[tabindex="0"], button, a, input, select, [role="tab"], [role="button"], [role="combobox"]', isTV = false } = options;

  useEffect(() => {
    if (!isTV) return;

    const getFocusableElements = (): HTMLElement[] => {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
    };

    const getRect = (el: HTMLElement) => el.getBoundingClientRect();

    const findTarget = (
      elements: HTMLElement[],
      current: HTMLElement,
      direction: 'up' | 'down' | 'left' | 'right'
    ): HTMLElement | null => {
      const currentRect = getRect(current);
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;

      let bestCandidate: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const el of elements) {
        if (el === current) continue;

        const rect = getRect(el);
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = centerX - currentCenterX;
        const dy = centerY - currentCenterY;

        let isDirectional = false;
        let primaryDistance = 0;
        let secondaryDistance = 0;

        switch (direction) {
          case 'right':
            isDirectional = dx > 0;
            primaryDistance = dx;
            secondaryDistance = Math.abs(dy);
            break;
          case 'left':
            isDirectional = dx < 0;
            primaryDistance = -dx;
            secondaryDistance = Math.abs(dy);
            break;
          case 'down':
            isDirectional = dy > 0;
            primaryDistance = dy;
            secondaryDistance = Math.abs(dx);
            break;
          case 'up':
            isDirectional = dy < 0;
            primaryDistance = -dy;
            secondaryDistance = Math.abs(dx);
            break;
        }

        if (!isDirectional) continue;

        const score = primaryDistance + secondaryDistance * 2;

        if (score < bestScore) {
          bestScore = score;
          bestCandidate = el;
        }
      }

      return bestCandidate;
    };

    // 在 window 上监听（而非 container），确保无论焦点在导航栏还是页面内都能捕获方向键。
    // Keep-Alive 下多个页面同时挂载，通过 offsetParent 可见性检查只让活动页处理。
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      // 容器不存在或不可见（Keep-Alive 隐藏页 display:none → offsetParent===null）→ 跳过
      if (!container || container.offsetParent === null) return;

      const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      const direction = directionMap[e.key];
      if (!direction) return;

      const elements = getFocusableElements();
      // 容器内没有可聚焦元素 → 放行，让浏览器默认滚动行为生效
      if (elements.length === 0) return;

      e.preventDefault();

      const activeElement = document.activeElement as HTMLElement;
      if (!container.contains(activeElement)) {
        // 焦点不在容器内（如顶部导航栏）→ 聚焦第一个元素
        elements[0].focus();
        return;
      }

      const target = findTarget(elements, activeElement, direction);
      if (target) {
        target.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, selector, isTV]);
}
