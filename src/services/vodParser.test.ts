import { describe, it, expect } from 'vitest';
import { parsePlaySources, pickTitle, isValidVideoUrl, detectSourceType } from './vodParser';

describe('pickTitle', () => {
  it('从 $ 分隔的 parts 中提取标题', () => {
    expect(pickTitle(['标题', 'http://example.com/video.m3u8'], '默认')).toBe('标题');
  });

  it('跳过 URL 和空串', () => {
    expect(pickTitle(['', 'http://example.com', '有效标题'], '默认')).toBe('有效标题');
  });

  it('全部为空时返回 fallback', () => {
    expect(pickTitle(['', 'http://x.com', '//y.com'], '默认')).toBe('默认');
  });

  it('空数组返回 fallback', () => {
    expect(pickTitle([], '默认')).toBe('默认');
  });
});

describe('isValidVideoUrl', () => {
  it('识别 m3u8 URL', () => {
    expect(isValidVideoUrl('http://example.com/video.m3u8')).toBe(true);
  });

  it('识别 mp4 URL', () => {
    expect(isValidVideoUrl('http://example.com/video.mp4')).toBe(true);
  });

  it('识别 mpd (DASH) URL', () => {
    expect(isValidVideoUrl('http://example.com/video.mpd')).toBe(true);
  });

  it('识别带查询参数的 URL', () => {
    expect(isValidVideoUrl('http://example.com/video.m3u8?token=abc')).toBe(true);
  });

  it('拒绝无后缀 URL', () => {
    expect(isValidVideoUrl('http://example.com/video')).toBe(false);
  });

  it('拒绝 HTML URL', () => {
    expect(isValidVideoUrl('http://example.com/page.html')).toBe(false);
  });

  it('放行 query 参数携带真实地址的中转链接', () => {
    expect(isValidVideoUrl('https://proxy.com/get?url=https://a.com/v.m3u8&t=1')).toBe(true);
  });

  it('放行加密中转脚本（m3u8.php?url=base64）', () => {
    expect(isValidVideoUrl('https://x.com/m3u8.php?url=aHR0cHM6Ly9hLmNvbQ')).toBe(true);
  });

  it('放行播放脚本（play.php?id=123）', () => {
    expect(isValidVideoUrl('https://x.com/play.php?id=123')).toBe(true);
  });

  it('放行解析脚本（jiexi.php 带任意参数）', () => {
    expect(isValidVideoUrl('https://x.com/jiexi.php?sig=abc')).toBe(true);
  });

  it('拒绝无参数的普通 php 页面', () => {
    expect(isValidVideoUrl('https://x.com/index.php')).toBe(false);
  });

  it('放行浏览器原生可播格式（webm/ogg/ogv/m4v/mov）', () => {
    expect(isValidVideoUrl('http://a.com/v.webm')).toBe(true);
    expect(isValidVideoUrl('http://a.com/v.ogg')).toBe(true);
    expect(isValidVideoUrl('http://a.com/v.ogv')).toBe(true);
    expect(isValidVideoUrl('http://a.com/v.m4v')).toBe(true);
    expect(isValidVideoUrl('http://a.com/v.mov')).toBe(true);
  });

  it('放行常见封装格式（mkv/flv/avi/wmv/rmvb/rm/ts/3gp/m2ts/asf/f4v）', () => {
    for (const ext of ['mkv', 'flv', 'avi', 'wmv', 'rmvb', 'rm', 'ts', '3gp', 'm2ts', 'asf', 'f4v']) {
      expect(isValidVideoUrl(`http://a.com/v.${ext}`)).toBe(true);
    }
  });

  it('放行 query 内嵌常见格式（如 proxy?url=xx.mkv）', () => {
    expect(isValidVideoUrl('https://proxy.com/get?url=https://a.com/v.mkv&t=1')).toBe(true);
  });
});

describe('detectSourceType', () => {
  it('.m3u8 → m3u8', () => {
    expect(detectSourceType('http://a.com/v.m3u8')).toBe('m3u8');
  });

  it('m3u8 中转脚本 → m3u8', () => {
    expect(detectSourceType('https://x.com/m3u8.php?url=aHR0')).toBe('m3u8');
  });

  it('.mpd → dash', () => {
    expect(detectSourceType('http://a.com/v.mpd')).toBe('dash');
  });

  it('.mpd 带 query → dash', () => {
    expect(detectSourceType('http://a.com/v.mpd?token=1')).toBe('dash');
  });

  it('其余 → mp4（原生）', () => {
    expect(detectSourceType('http://a.com/v.mp4')).toBe('mp4');
    expect(detectSourceType('https://x.com/play.php?id=123')).toBe('mp4');
  });

  it('原生可播封装 → mp4（mov/webm/ogg/ogv/m4v）', () => {
    expect(detectSourceType('http://a.com/v.mov')).toBe('mp4');
    expect(detectSourceType('http://a.com/v.webm')).toBe('mp4');
    expect(detectSourceType('http://a.com/v.ogg')).toBe('mp4');
    expect(detectSourceType('http://a.com/v.ogv')).toBe('mp4');
    expect(detectSourceType('http://a.com/v.m4v')).toBe('mp4');
  });

  it('无转码能力的封装 → 仍归 mp4（交由浏览器尝试解码）', () => {
    for (const ext of ['mkv', 'flv', 'avi', 'wmv', 'rmvb', 'rm', 'ts', '3gp', 'm2ts', 'asf', 'f4v']) {
      expect(detectSourceType(`http://a.com/v.${ext}`)).toBe('mp4');
    }
  });
});

describe('parsePlaySources', () => {
  describe('空输入', () => {
    it('空字符串返回空结果', () => {
      const result = parsePlaySources('');
      expect(result.sources).toEqual([]);
      expect(result.episodes).toBeUndefined();
    });

    it('纯空白返回空结果', () => {
      const result = parsePlaySources('   ');
      expect(result.sources).toEqual([]);
    });
  });

  describe('电影模式（vodType=movie）', () => {
    it('单条线路单集 → sources 数组', () => {
      const result = parsePlaySources('线路1$http://example.com/video.m3u8', 'movie');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].url).toBe('http://example.com/video.m3u8');
      expect(result.sources[0].type).toBe('m3u8');
      expect(result.sources[0].isDefault).toBe(true);
      expect(result.episodes).toBeUndefined();
    });

    it('单条线路多集 → sources 数组（电影多地址）', () => {
      const result = parsePlaySources(
        '线路1$http://a.com/v1.mp4#线路2$http://b.com/v2.mp4',
        'movie'
      );
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].name).toBe('线路1');
      expect(result.sources[1].name).toBe('线路2');
    });

    it('多条线路 → sources 合并', () => {
      const result = parsePlaySources(
        '线路1$http://a.com/v.m3u8$$$线路2$http://b.com/v.mp4',
        'movie'
      );
      expect(result.sources).toHaveLength(2);
    });
  });

  describe('多条线路去重', () => {
    it('同名线路自动加序号后缀', () => {
      const result = parsePlaySources(
        '线路$http://a.com/v1.m3u8$$$线路$http://b.com/v2.m3u8',
        'movie'
      );
      expect(result.sources[0].name).toContain('线路');
      expect(result.sources[1].name).toContain('线路');
      expect(result.sources[0].name).not.toBe(result.sources[1].name);
    });
  });

  describe('类型检测', () => {
    it('m3u8 URL → type=m3u8', () => {
      const result = parsePlaySources('源$http://x.com/v.m3u8', 'movie');
      expect(result.sources[0].type).toBe('m3u8');
    });

    it('mpd URL → type=dash', () => {
      const result = parsePlaySources('源$http://x.com/v.mpd', 'movie');
      expect(result.sources[0].type).toBe('dash');
    });

    it('mp4 URL → type=mp4', () => {
      const result = parsePlaySources('源$http://x.com/v.mp4', 'movie');
      expect(result.sources[0].type).toBe('mp4');
    });

    it('mkv 等无转码封装 → type=mp4 且正常进入 sources（不被过滤）', () => {
      const result = parsePlaySources('源$http://x.com/v.mkv', 'movie');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].type).toBe('mp4');
    });
  });

  describe('边界情况', () => {
    it('无扩展名的 URL 被过滤', () => {
      const result = parsePlaySources('第1集$http://example.com/noext');
      expect(result.episodes).toBeUndefined();
    });

    it('空 $$$ 分段被忽略', () => {
      const result = parsePlaySources('$$$http://a.com/v.m3u8$$$');
      expect(result.sources.length + (result.episodes?.length ?? 0)).toBeGreaterThanOrEqual(1);
    });
  });
});
