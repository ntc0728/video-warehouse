import { useEffect } from 'react';

/** 快捷键配置 */
interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description?: string;
}

/**
 * 全局键盘快捷键 Hook
 * 当用户按下指定组合键时触发对应回调，自动跳过输入框内的按键
 * @param shortcuts 快捷键配置数组
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === e.ctrlKey;
        const altMatch = !!shortcut.altKey === e.altKey;
        const shiftMatch = !!shortcut.shiftKey === e.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export type { ShortcutConfig };
