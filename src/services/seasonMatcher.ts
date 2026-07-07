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
