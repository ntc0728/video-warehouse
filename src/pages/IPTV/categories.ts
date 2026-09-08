import type { IPTVChannel, IPTVGroup } from '@/types/iptv';

/**
 * IPTV 页「频道分类」固定文本归类工具（2026-09-08 IPTV 页大改）。
 *
 * 左栏分类为固定文本（全部 / 央视CCTV / 主流卫视 / 地方卫视 / 港澳台 / 体育 /
 * 影视 / 少儿 / 新闻 / 我的收藏），不再依赖 M3U 的 group 字段——采集站分组名
 * 五花八门，固定文本按频道名归类才能保证左栏计数与分节稳定。
 *
 * 归类判据全部基于频道名（demo 终稿规则，changelogs/demos/demo-iptv-rail-2026-09-08.html）：
 * 判定顺序 CCTV → 新闻 → 港澳台 → 体育 → 影视 → 少儿 → 卫视（主流/地方）→ 其他。
 * 例：CCTV-5 体育 → CCTV（CCTV 优先）；凤凰资讯台 → 新闻（新闻优先于港澳台）；
 *     湖南卫视 → 主流卫视；安徽卫视 → 地方卫视。
 */

export type IptvCategoryKey =
  | '__all__'
  | 'cctv'
  | 'mainstream'
  | 'local'
  | 'hmt' // 港澳台
  | 'sports'
  | 'movie'
  | 'kids'
  | 'news'
  | '__other__'
  | '__fav__';

export interface IptvCategory {
  key: IptvCategoryKey;
  label: string;
}

/** 左栏固定文本分类（顺序 = 分节顺序 = 左栏展示顺序） */
export const IPTV_CATEGORIES: IptvCategory[] = [
  { key: '__all__', label: '全部频道' },
  { key: 'cctv', label: '央视 CCTV' },
  { key: 'mainstream', label: '主流卫视' },
  { key: 'local', label: '地方卫视' },
  { key: 'hmt', label: '港澳台' },
  { key: 'sports', label: '体育' },
  { key: 'movie', label: '影视' },
  { key: 'kids', label: '少儿' },
  { key: 'news', label: '新闻' },
  { key: '__fav__', label: '我的收藏' },
];

/** 主流卫视名单（demo 定稿 8 个；其余「XX卫视」归地方卫视） */
const MAINSTREAM_SATELLITES = [
  '湖南卫视',
  '浙江卫视',
  '江苏卫视',
  '东方卫视',
  '北京卫视',
  '广东卫视',
  '山东卫视',
  '深圳卫视',
];

const RE = {
  cctv: /cctv|央视/i,
  news: /新闻|资讯/i,
  hmt: /凤凰|翡翠|tvb|tvbs|星空|澳门|香港|本港|明珠|亚视|有线/i,
  sports: /体育|足球|篮球|网球|电竞|赛事|搏击|高尔夫/i,
  movie: /电影|影院|剧场|影视|追剧/i,
  kids: /少儿|卡通|动漫|动画|亲子|幼儿|宝宝/i,
  satellite: /卫视/,
};

/**
 * 按频道名归类。返回 null 表示不属于任何固定分类（分节时进「其他」兜底节）。
 * 参数只依赖 name 与 isFavorite，避免调用方传整卡。
 */
export function categoryOfChannel(
  ch: { name: string; isFavorite?: boolean }
): IptvCategoryKey | null {
  const name = ch.name || '';
  if (RE.cctv.test(name)) return 'cctv';
  if (RE.news.test(name)) return 'news';
  if (RE.hmt.test(name)) return 'hmt';
  if (RE.sports.test(name)) return 'sports';
  if (RE.movie.test(name)) return 'movie';
  if (RE.kids.test(name)) return 'kids';
  if (RE.satellite.test(name)) {
    return MAINSTREAM_SATELLITES.includes(name) ? 'mainstream' : 'local';
  }
  return null;
}

/**
 * 频道是否属于指定分类（含 __all__ / __fav__ / __other__ 兜底节）。
 * __fav__ 依赖 isFavorite 标记（store 已在加载/切换时同步）。
 */
export function inCategory(
  ch: { name: string; isFavorite?: boolean },
  key: IptvCategoryKey
): boolean {
  if (key === '__all__') return true;
  if (key === '__fav__') return !!ch.isFavorite;
  if (key === '__other__') return categoryOfChannel(ch) === null;
  return categoryOfChannel(ch) === key;
}

/**
 * 按固定文本分类把频道切成 IPTVGroup 列表（IPTV 页左栏同款口径）。
 * 供 IPTV 播放页频道侧栏复用——不再用 M3U 的 group 字段（采集站分组名五花八门）。
 * - 顺序 = IPTV_CATEGORIES 顺序，跳过 __all__（侧栏逐类切换，不需要「全部」聚合项）；
 * - 空分类不输出，避免侧栏出现一堆 0 条的分组；
 * - 「其他」兜底节放末尾（IPTV_CATEGORIES 未含，单独追加），保证不藏频道。
 */
export function buildCategoryGroups(channels: IPTVChannel[]): IPTVGroup[] {
  const groups: IPTVGroup[] = [];
  const push = (key: IptvCategoryKey, label: string) => {
    const list = channels.filter((ch) => inCategory(ch, key));
    if (list.length === 0) return;
    groups.push({ name: label, count: list.length, channels: list });
  };

  for (const cat of IPTV_CATEGORIES) {
    if (cat.key === '__all__') continue;
    push(cat.key, cat.label);
  }
  push('__other__', '其他');
  return groups;
}
