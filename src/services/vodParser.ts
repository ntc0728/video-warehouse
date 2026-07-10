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

const VALID_VIDEO_EXTENSIONS = /\.(m3u8|mp4|mpd|flv|ts|mkv|avi|wmv|rmvb|rm|3gp|mov|m4s|aac)(\?.*)?$/i;

/** 检查 URL 是否有有效视频后缀，无后缀说明链接被设置了访问权限 */
export function isValidVideoUrl(url: string): boolean {
  return VALID_VIDEO_EXTENSIONS.test(url);
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
        const type = url.includes('.m3u8') ? 'm3u8' as const : url.includes('.mpd') ? 'dash' as const : 'mp4' as const;
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
        const type = url.includes('.m3u8') ? 'm3u8' as const : url.includes('.mpd') ? 'dash' as const : 'mp4' as const;
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
            id: `source-${i}`,
            name: entry.title,
            url: entry.url,
            type: entry.type,
            isDefault: idx === 0,
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

  // 后置检测：若 allSources 为空但 episodesMap 有数据，且非显式 tv/anime，
  // 说明 CMS 未返回正确 vod_type，按电影处理（线路列表而非选集）
  if (allSources.length === 0 && episodesMap.size > 0 && vodType !== 'tv' && vodType !== 'anime') {
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
