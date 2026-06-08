/**
 * 字幕相关类型定义
 * 仅保留字幕显示样式设置（实际使用中）
 *
 * 注：原 SubtitleCue / SubtitleTrack 类型于 2026-06-06 清理 AI 语音识别时移除。
 */

/** 字幕显示样式设置 */
export interface SubtitleSettings {
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  position: 'bottom' | 'top';
  opacity: number;
}
