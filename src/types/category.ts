/**
 * Browse 分类 key（全站共用）
 *
 * 原由 CategoryQuickAccess 组件导出； 首页分类快捷入口组件
 * 整体删除（宽屏本就无分类入口），类型迁至此处供
 * Browse（constants / urlState / 骨架）与 FilterBar 继续消费。
 *
 * 「全部」已下线（tv+movie 合并页的页数/入参无法稳定对齐），默认入口为「电影」；
 * variety / anime 仍作为 Chart tab / CMS 类型保留，但不作为 Browse 可选分类。
 */
export type CategoryKey = 'all' | 'movie' | 'tv' | 'variety' | 'anime' | 'top' | 'documentary';
