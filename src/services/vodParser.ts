import type { Video, VideoType } from '@/types/video';

/** 从 $ 分隔的 parts 中提取标题：跳过 URL 和空串，取第一个有意义的部分 */
export function pickTitle(parts: string[], fallback: string): string {
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k].trim();
    if (!p || p.startsWith('http') || p.startsWith('//')) continue;
    return p;
  }
  return fallback;
}

// 常见视频扩展名（直链结尾，含 query/fragment）。覆盖：
// - 流媒体协议：m3u8(HLS) / mpd(DASH)
// - 浏览器原生可播：mp4 / m4v / mov / webm / ogg / ogv
// - 其余常见封装（mkv / flv / avi / wmv / rmvb / rm / ts / m2ts / 3gp / asf / f4v / m4s / aac），
//   无转码能力下只能交由原生 <video> 尝试解码（见 detectSourceType）
const VALID_VIDEO_EXTENSIONS = /\.(m3u8|mp4|m4v|mpd|webm|ogg|ogv|flv|ts|m2ts|mkv|avi|wmv|rmvb|rm|3gp|mov|m4s|aac|asf|f4v)(\?.*)?$/i;

// URL 任意位置（路径中段或 query 参数值内）出现的视频扩展名特征，如 /proxy?url=xx.mkv&t=1
const EMBEDDED_VIDEO_EXT = /\.(m3u8|mp4|m4v|mpd|webm|ogg|ogv|flv|ts|m2ts|mkv|avi|wmv|rmvb|rm|3gp|mov|asf|f4v)([?&#/;]|$)/i;

// 播放中转脚本：动态脚本 + 携带目标地址/资源 ID 参数（如 m3u8.php?url=aHR0... / play.php?id=123）
const PROXY_SCRIPT_WITH_PARAM = /\.(php|do|action|aspx?|jsp|cgi)\?(?:[^#]*&)?(?:url|u|v|vid|video|link|src|target|id|sign)=[^&#]+/i;

// 脚本文件名本身含播放特征（如 /m3u8.php?... / /jiexi.php?...），参数名不限
const PLAY_SCRIPT_NAME = /\/[^/?#]*(?:m3u8|jiexi|parse|player|play)[^/?#]*\.(?:php|do|action|aspx?|jsp|cgi)\?/i;

/**
 * 检查 URL 是否为有效播放链接。
 * 依次放行：标准视频后缀结尾 → URL 任意位置含视频扩展特征（中转/代理链接）→
 * 播放中转脚本（动态脚本带 url/id 等参数，CMS 常见的加密/解析链接）。
 * 均不命中（如纯 html 页面、无任何特征的裸路径）才判为无效。
 */
export function isValidVideoUrl(url: string): boolean {
  return VALID_VIDEO_EXTENSIONS.test(url)
    || EMBEDDED_VIDEO_EXT.test(url)
    || PROXY_SCRIPT_WITH_PARAM.test(url)
    || PLAY_SCRIPT_NAME.test(url);
}

/**
 * 根据 URL 推断播放源类型：
 * 含 m3u8 特征（扩展名或中转脚本名如 m3u8.php）→ hls；.mpd → dash；其余走原生播放。
 */
export function detectSourceType(url: string): 'm3u8' | 'dash' | 'mp4' {
  if (/m3u8/i.test(url)) return 'm3u8';
  if (/\.mpd([?&#/;]|$)/i.test(url)) return 'dash';
  return 'mp4';
}

/** 解析播放源字符串，提取源列表和分集信息 */
export function parsePlaySources(vodPlayUrl: string, vodType?: VideoType): { sources: Video['sources']; episodes: Video['episodes'] } {
  const isMovie = vodType === 'movie';
  const urlList = vodPlayUrl ? vodPlayUrl.split('$$$').filter(Boolean) : [];
  if (urlList.length === 0) return { sources: [], episodes: undefined };

  const allSources: Video['sources'] = [];
  const episodesMap = new Map<string, { title: string; url: string; sources: Video['sources'] }>();

  for (let i = 0; i < urlList.length; i++) {
    const urlStr = urlList[i];
    const episodes = urlStr.split('#').filter(Boolean);
    if (episodes.length === 0) continue;

    const validEpisodes = episodes.filter(ep => {
      const parts = ep.split('$');
      const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      return url && url.includes('.');
    });
    if (validEpisodes.length === 0) continue;

    if (validEpisodes.length === 1) {
      const parts = validEpisodes[0].split('$');
      const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      if (url && isValidVideoUrl(url)) {
        const type = detectSourceType(url);
        const name = pickTitle(parts.slice(0, -1), `源${i + 1}`);
        if (isMovie) {
          allSources.push({ id: `source-${i}`, name, url, type, isDefault: allSources.length === 0 });
        } else {
          episodesMap.set(url, { title: name, url, sources: [{ id: `source-${i}-ep-0`, name: `源${i + 1}`, url, type, isDefault: i === 0 }] });
        }
      }
    } else {
      const titleCount: Record<string, number> = {};
      for (const ep of validEpisodes) {
        const parts = ep.split('$');
        const title = pickTitle(parts.slice(0, -1), '');
        if (title) titleCount[title] = (titleCount[title] || 0) + 1;
      }

      const titleSeq: Record<string, number> = {};
      const parsed: { title: string; rawTitle: string; url: string; type: Video['sources'][number]['type'] }[] = [];
      for (let j = 0; j < validEpisodes.length; j++) {
        const parts = validEpisodes[j].split('$');
        const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        if (!url || !isValidVideoUrl(url)) continue;
        const rawTitle = pickTitle(parts.slice(0, -1), '第' + (j + 1) + '集');
        const type = detectSourceType(url);
        let displayTitle = rawTitle;
        if ((titleCount[rawTitle] ?? 0) > 1) {
          titleSeq[rawTitle] = (titleSeq[rawTitle] || 0) + 1;
          displayTitle = `${rawTitle}${String(titleSeq[rawTitle]).padStart(2, '0')}`;
        }
        parsed.push({ title: displayTitle, rawTitle, url, type });
      }

      if (isMovie) {
        parsed.forEach((entry, idx) => {
          allSources.push({
            // 同组多分段加条目序号，避免 id 重复（同组全部复用 source-${i} 会触发 React 重复 key）
            id: `source-${i}-${idx}`,
            name: entry.title,
            url: entry.url,
            type: entry.type,
            // 与单段分支一致：仅全局首个源为默认（旧实现 idx===0 会让每组首个都标记默认）
            isDefault: allSources.length === 0,
          });
        });
      } else {
        for (const entry of parsed) {
          if (!episodesMap.has(entry.url)) episodesMap.set(entry.url, { title: entry.title, url: entry.url, sources: [] });
          const ep = episodesMap.get(entry.url)!;
          const srcId = `source-${i}-ep-${ep.sources.length}`;
          // 按 ID 去重：同一条 source line 被多次处理时避免重复
          if (!ep.sources.some(s => s.id === srcId)) {
            ep.sources.push({
              id: srcId,
              name: `源${i + 1}`,
              url: entry.url,
              type: entry.type,
              isDefault: i === 0,
            });
          }
        }
      }
    }
  }

  // 后置检测：若 allSources 为空但 episodesMap 有数据，且显式标记为 movie，
  // 按电影处理（线路列表而非选集）。注意：vodType 为 undefined 时不应触发此转换，
  // 否则 CMS 未返回类型信息的剧集视频会被错误地转为线路。
  if (allSources.length === 0 && episodesMap.size > 0 && vodType === 'movie') {
    for (const [, ep] of episodesMap) {
      for (const src of ep.sources) {
        allSources.push({ id: src.id, name: ep.title || src.name, url: src.url, type: src.type, isDefault: allSources.length === 0 });
      }
    }
    episodesMap.clear();
  }

  // 同名线路加后缀区分
  const nameCount: Record<string, number> = {};
  for (const s of allSources) {
    nameCount[s.name] = (nameCount[s.name] || 0) + 1;
  }
  const nameSeq: Record<string, number> = {};
  for (const s of allSources) {
    if ((nameCount[s.name] ?? 0) > 1) {
      nameSeq[s.name] = (nameSeq[s.name] || 0) + 1;
      s.name = `${s.name}${String(nameSeq[s.name]).padStart(2, '0')}`;
    }
  }

  let episodes: Video['episodes'] | undefined;
  if (episodesMap.size > 0) {
    episodes = Array.from(episodesMap.entries()).map(([key, ep], index) => ({
      id: key, vodId: '', url: ep.url, title: ep.title, number: index + 1, sources: ep.sources,
    }));
  }
  return { sources: allSources, episodes };
}
