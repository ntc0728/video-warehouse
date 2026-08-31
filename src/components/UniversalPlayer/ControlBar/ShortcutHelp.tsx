import { useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

interface ShortcutHelpProps {
  visible: boolean;
  onClose: () => void;
}

/** 快捷键分组表（与 useKeyboardShortcuts 保持同步，改键位务必同步这里） */
const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: '播放控制',
    items: [
      ['Space / K', '播放 / 暂停'],
      ['J / L', '后退 / 前进 10s'],
      ['← / →', '后退 / 前进 5s'],
      [', / .', '逐帧（先暂停）'],
      ['R', '循环模式'],
    ],
  },
  {
    title: '进度与音量',
    items: [
      ['0 – 9', '跳转到 0% – 90%'],
      ['Home / End', '开头 / 结尾'],
      ['↑ / ↓', '音量 ±10%'],
      ['M', '静音'],
    ],
  },
  {
    title: '画面与显示',
    items: [
      ['F', '全屏 / 退出全屏'],
      ['P', '画中画'],
      ['C', '字幕开关'],
      ['双击画面', '全屏'],
    ],
  },
  {
    title: '剧集',
    items: [
      ['[ / ]', '上一集 / 下一集'],
      ['Esc', '隐藏控制栏 / 关闭弹层'],
    ],
  },
];

/**
 * P1-5：快捷键面板（Shift+? / 更多菜单调出）。
 * 桌面端专属；对齐 B站 / YouTube 的「键位速查」体验。
 */
export default function ShortcutHelp({ visible, onClose }: ShortcutHelpProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // capture：抢在全局快捷键 Escape（隐藏控制栏）之前处理
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="up-shortcut-help" onClick={onClose}>
      <div
        className="up-shortcut-help__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="键盘快捷键"
      >
        <div className="up-shortcut-help__header">
          <Icon icon={Keyboard} size="sm" />
          <span>键盘快捷键</span>
          <span className="up-shortcut-help__hint">按 Esc 关闭</span>
        </div>
        <div className="up-shortcut-help__grid">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="up-shortcut-help__group">
              <div className="up-shortcut-help__group-title">{group.title}</div>
              {group.items.map(([keys, desc]) => (
                <div key={keys} className="up-shortcut-help__row">
                  <kbd>{keys}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
