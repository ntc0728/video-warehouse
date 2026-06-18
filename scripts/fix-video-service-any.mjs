// scripts/fix-video-service-any.mjs
import fs from 'node:fs';

const path = 'd:/trae/5.13/video-warehouse/src/services/videoService.ts';
let s = fs.readFileSync(path, 'utf-8');

// 1. line ~80: `if (data && (data as any).list && Array.isArray((data as any).list)) {`
s = s.replace(
  /const data = await getJSON\(source\.api, \{ useProxy: true, timeout \}\);\s*\n\s*if \(data && \(data as any\)\.list && Array\.isArray\(\(data as any\)\.list\)\) \{/,
  `const data = await getJSON<CMSListResponse>(source.api, { useProxy: true, timeout });\n    if (data && Array.isArray(data.list)) {`
);

// 2. ~line 84: `} catch (error: any) {` — 用 unknown + instanceof Error
s = s.replace(
  /} catch \(error: any\) \{[\s\S]*?error\?\.message \|\| '[^']+',\s*\n\s*\};/g,
  `} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      index: sourceIndex,
      name: source.name,
      available: false,
      error: message || '未知错误',
    };
  }`
);

// 3. ~line 168: `const data: any = await getJSON(...)` — 改为类型化
s = s.replace(
  /const data: any = await getJSON\(source\.api, \{ useProxy: true, timeout: 15000 \}\);/,
  `const data = await getJSON<CMSListResponse>(source.api, { useProxy: true, timeout: 15000 });`
);

// 4. ~line 173: `} catch (error: any) {` (in fetchVideosBySource)
s = s.replace(
  /} catch \(error: any\) \{\s*\n\s*console\.warn\(.*?\);\s*\n\s*return \{\s*\n\s*videos: \[\],?\s*\n\s*sourceInfo: \{ index: sourceIndex, name: source\.name \},?\s*\n\s*error: `\S+\$\{error\?\.message \|\| '\S+'\}`,\s*\n\s*\};/,
  `} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(\`Failed to fetch videos from \${source.name}:\`, error);
    return {
      videos: [],
      sourceInfo: { index: sourceIndex, name: source.name },
      error: \`无法连接到 \${source.name}：\${message || '未知错误'}\`,
    };
  }`
);

// 5. ~line 199: `function mapVideoItem(item: any): Video {`
s = s.replace(
  /function mapVideoItem\(item: any\): Video \{/,
  `function mapVideoItem(item: CMSVideoItem): Video {`
);

// 6. ~line 199 inner: `type: mapVodType(item.vod_type) as any,` — 修正类型
s = s.replace(
  /type: mapVodType\(item\.vod_type\) as any,/,
  `type: mapVodType(item.vod_type) ?? 'movie',`
);

// 7. ~line 211: `} catch (error) {` (in fetchVideoDetail) — 已经是非 any
// 跳过
// 8. ~line 273: `const data: any = await getJSON(searchUrl, { useProxy: true });`
s = s.replace(
  /const data: any = await getJSON\(searchUrl, \{ useProxy: true \}\);/,
  `const data = await getJSON<CMSListResponse>(searchUrl, { useProxy: true });`
);

// 9. ~line 275: `const match = data.list.find((item: any) => {`
s = s.replace(
  /const match = data\.list\.find\(\(item: any\) => \{/,
  `const match = data.list.find((item: CMSVideoItem) => {`
);

// 删除未使用的 CMSListResponse 接口 — 但其实现在要用了，先保留
// 但 lint 报"未使用"，可能是 getJSON<CMSListResponse> 还没被检测到。运行 tsc 之前
// 看不到效果，lint 是基于 tsc 的。

fs.writeFileSync(path, s, 'utf-8');
console.log('Modified videoService.ts, length:', s.length);
