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
  /** 美术资源皮肤画风：default(无) / cartoon(卡通) / mechanical(机械) / retro(复古) */
  skin: 'default' | 'cartoon' | 'mechanical' | 'retro';
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
  /** 强制 TV 模式（用于在非 TV 设备上体验遥控器交互） */
  tvMode: boolean;
  /** TV 过扫描（overscan）安全区大小：0–10，单位 vw（左右）/ vh（上下）；0 = 铺满到裁切边 */
  tvOverscan: number;
  /** 用户昵称（个人资料） */
  username: string;
  /** 用户头像（data URL，留空则使用默认图标） */
  avatar: string;
}
