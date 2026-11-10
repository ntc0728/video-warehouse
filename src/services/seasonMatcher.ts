/** 从 vod_name 中解析季号 */

const CN_SEASON_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
};

/** 从 vod_name 中提取季号，无法识别时返回 undefined */
export function extractSeasonNumber(vodName: string): number | undefined {
  // 中文数字季号：第X季
  const cnMatch = vodName.match(/第([一二三四五六七八九十]+)季/);
  if (cnMatch) {
    const num = CN_SEASON_MAP[cnMatch[1]];
    if (num !== undefined) return num;
  }

  // 阿拉伯数字季号：第3季 / 第03季
  const arMatch = vodName.match(/第(\d+)季/);
  if (arMatch) {
    const num = parseInt(arMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 英文季号：Season 2 / season2
  const enMatch = vodName.match(/season\s*(\d+)/i);
  if (enMatch) {
    const num = parseInt(enMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 英文缩写季号：S02 / s2
  const sMatch = vodName.match(/\bS(\d+)\b/i);
  if (sMatch) {
    const num = parseInt(sMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return undefined;
}

/**
 * 特别篇条目识别：CMS 把特别篇存为独立 vod 条目（如「神秘博士60周年特别篇」），
 * 无季号，靠 vod_name 中的特殊内容标记区分。
 *
 * 关键词集合参照主流约定收敛：
 * - TMDB TV Bible：Season 0 = Specials（特別編/総集編/OVA/番外篇等未按常规季播出的内容）
 * - 媒体库规范（Jellyfin/Emby/Plex 命名实践）：Special / SP / OVA / OAD 识别词
 * - 中文章节：特别篇/特辑/番外/外传/剧场版/总集篇（含繁体与日文汉字变体）
 * - 显式季 0：第0季 / Season 0 / S0（extractSeasonNumber 对 0 有 num > 0 守卫，不会误归正季）
 *
 * 仅在 extractSeasonNumber 未命中时调用（正季优先，避免「第X季特别篇」误入特别篇桶）。
 * 误判代价可控：条目只是从「被静默丢弃」变为「进特别篇桶」，数据仍然可见，不会被过滤。
 */
const SPECIAL_TITLE_RE = new RegExp(
  [
    // 简繁 + 日文汉字变体
    '特别篇', '特別篇', '特别编', '特別編', '特别版', '特別版', '特别节目', '特輯', '特辑',
    '番外', '外传', '外傳',
    '剧场版', '劇場版',
    '总集篇', '總集篇', '总集编', '總集編', '総集篇', '総集編',
    // 显式季 0（extractSeasonNumber 拒收 0，落到这里才算特别篇）
    '第\\s*0\\s*季',
    'season\\s*0+\\b',
    '\\bS0+\\b',
    // 英文/缩写（词边界防误伤：SPY 不含独立 SP）
    '\\bOVA\\b', '\\bOAD\\b', '\\bSP\\b', '\\bSpecials?\\b',
  ].join('|'),
  'i',
);

/** 判断 vod_name 是否为特别篇类条目（特别篇/特辑/番外/剧场版/OVA/OAD/SP 等） */
export function isSpecialEntryTitle(vodName: string): boolean {
  return SPECIAL_TITLE_RE.test(vodName);
}
