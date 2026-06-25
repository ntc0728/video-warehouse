/**
 * 应用设置类型定义
 * 定义全局应用配置的数据结构
 */

/** 应用全局设置 */
export interface AppSettings {
  videoSourceIndex: number;
  videoSourceIndices: number[];
  iptvSourceIndex: number;
  iptvSourceIndices: number[];
  theme: 'light' | 'dark' | 'system';
  /** 跳过片头 */
  skipIntro: boolean;
  /** 跳过片尾 */
  skipOutro: boolean;
  /** 片头跳过时长（秒） */
  skipIntroDuration: number;
  /** 片尾跳过时长（秒） */
  skipOutroDuration: number;
  /** 自动连播 */
  autoPlay: boolean;
}
