/**
 * 数据源配置类型定义
 * 定义视频采集站 API 配置、IPTV 播放列表源、EPG 源
 *
 * [2026-08-07 源管理整改]
 * - 新增 ManagedSource 系列：统一视频/IPTV/EPG 源的"管理"形态（启用/延迟/添加时间/类型）
 * - builtin 源来自打包 JSON，custom 源由用户在设置页添加
 * - builtin 可停用不可删除；custom 可删除
 */

/** 视频采集站 API 配置（原始形态，对应打包 video-sources.json） */
export interface VideoSourceConfig {
  /** 唯一标识，取自 video-sources.json 的 api_site key（如 "iqiyizyapi.com"） */
  id: string;
  name: string;
  api: string;
  detail: string;
  /** 请求超时 ms（custom 源可配；builtin 缺省用 httpClient 默认） */
  timeoutMs?: number;
  /** 请求重试次数（custom 源可配；builtin 缺省 0） */
  retries?: number;
}

/** 视频源配置数据格式（对应 video-sources.json） */
export interface VideoSourcesData {
  cache_time: number;
  api_site: Record<string, VideoSourceConfig>;
}

/** IPTV 播放列表源配置（原始形态，对应打包 iptv-sources.json） */
export interface IPTVSourceConfig {
  name: string;
  url: string;
}

/** EPG 源配置（原始形态，对应打包 epg-sources.json） */
export interface EPGSourceConfig {
  name: string;
  url: string;
}

/* ── 源管理（Managed）形态 ────────────────────── */

/** 源类型：爬建（打包内置） / 自建（用户添加） */
export type SourceKind = 'builtin' | 'custom';

/** 源启用状态 + 测速结果 */
export interface SourceStatus {
  enabled: boolean;
  /** 测速延迟，ms；null 表示未测速或超时 */
  latency: number | null;
  /** 测速时间戳 */
  latencyCheckedAt: number | null;
  /** 该源是否正在测速（用于列表项显示旋转图标） */
  measuring?: boolean;
}

/** 通用管理源基础字段 */
export interface ManagedSourceBase {
  /** 稳定唯一 id：builtin 用配置 key 或 name 派生，custom 用 crypto.randomUUID() */
  id: string;
  /** 显示名称 */
  name: string;
  /** 爬建 / 自建 */
  kind: SourceKind;
  /** 启用 + 测速状态 */
  status: SourceStatus;
  /** 添加时间（内置源 = 应用首次启动时间，自建源 = 用户添加时间） */
  addedAt: number;
  /** 列表顺序（按延迟排序时由 order 计算；当前无拖拽，order 仅用于稳定顺序展示） */
  order: number;
}

/** 视频源管理形态（视频源含 api/detail） */
export interface ManagedVideoSource extends ManagedSourceBase {
  api: string;
  detail: string;
}

/** IPTV 源管理形态（仅 URL） */
export interface ManagedIPTVSource extends ManagedSourceBase {
  url: string;
}

/** EPG 源管理形态（仅 URL） */
export interface ManagedEPGSource extends ManagedSourceBase {
  url: string;
}

/** 源场景类型（用于 SourceManager 通用组件泛型约束） */
export type SourceScene = 'video' | 'iptv' | 'epg';
