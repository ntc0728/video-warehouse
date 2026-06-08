import { useEffect } from 'react';

export function useSpatialNavigation(options: {
  containerRef: React.RefObject<HTMLElement | null>;
  selector?: string;
  isTV?: boolean;
}): void {
  const { containerRef, selector = '[tabindex="0"], button, a, input, select', isTV = false } = options;

  useEffect(() => {
    if (!isTV || !containerRef.current) return;

    const container = containerRef.current;

    const getFocusableElements = (): HTMLElement[] => {
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

    const handleKeyDown = (e: KeyboardEvent) => {
      const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      const direction = directionMap[e.key];
      if (!direction) return;

      e.preventDefault();

      const elements = getFocusableElements();
      const activeElement = document.activeElement as HTMLElement;

      if (!activeElement || !container.contains(activeElement)) {
        if (elements.length > 0) {
          elements[0].focus();
        }
        return;
      }

      const target = findTarget(elements, activeElement, direction);
      if (target) {
        target.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, selector, isTV]);
}
