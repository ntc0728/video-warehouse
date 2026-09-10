import type { LoopMode, PlayerLevel } from '@/types/player';

const VOLUME_POPUP_DELAY = 3000;

/** 循环模式切换顺序（R6：useKeyboardShortcuts 与 LoopButton 共用，避免重复定义） */
export const LOOP_CYCLE: LoopMode[] = ['none', 'single', 'list'];

/** 根据清晰度 level 生成展示标签（R3：ResolutionSwitch / MobileMoreSheet / switchLevel 共用） */
export function getResolutionLabel(level: PlayerLevel): string {
  if (level.height >= 2160) return '4K';
  if (level.height >= 1440) return '2K';
  if (level.height >= 1080) return '1080p';
  if (level.height >= 720) return '720p';
  if (level.height >= 480) return '480p';
  if (level.height >= 360) return '360p';
  if (level.height > 0) return `${level.height}p`;
  return level.name || '未知';
}

/** 档位是否可用于展示：manifest 未标 RESOLUTION / 纯音频轨的 level 高度为 0，对用户没有意义 */
export function isSelectableLevel(level: PlayerLevel): boolean {
  return level.height > 0;
}

/**
 * 清晰度菜单的可选项：过滤掉无有效分辨率的档位。
 *
 * 不过滤时 manifest 里 height=0 的档位会以「0P」这类非法标签混进菜单（用户可见 bug）。
 * 返回项带上 level 在 adapter levels 中的原始索引——选中后仍按原始索引提交给 setCurrentLevel，
 * 不能重新编号（hls.js 的 currentLevel 就是原始下标）。
 * 全部档位都无分辨率时返回空数组，菜单只剩「自动」。
 */
export function getSelectableLevels(levels: PlayerLevel[]): Array<{ index: number; level: PlayerLevel }> {
  const selectable: Array<{ index: number; level: PlayerLevel }> = [];
  levels.forEach((level, index) => {
    if (isSelectableLevel(level)) selectable.push({ index, level });
  });
  return selectable;
}

// 切集/切线路时的操作提示抑制窗口（毫秒）
let sourceToastSuppressUntil = 0;

export function getAutoHideDelay(): number {
  return 3000;
}

/** 临时抑制「已切换到线路名」ToastTrigger 提示的持续时间（毫秒） */
export function suppressSourceToast(ms: number): void {
  sourceToastSuppressUntil = Date.now() + ms;
}

/** 是否处于线路提示抑制窗口内 */
export function isSourceToastSuppressed(): boolean {
  return Date.now() < sourceToastSuppressUntil;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function srtToVtt(srt: string): string {
  let vtt = 'WEBVTT\n\n';
  const blocks = srt.trim().replace(/\r\n/g, '\n').split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1].replace(/,/g, '.');
      const text = lines.slice(2).join('\n');
      vtt += `${timeLine}\n${text}\n\n`;
    }
  }
  return vtt;
}

export { VOLUME_POPUP_DELAY };
