// scripts/backup-target-files.mjs
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'd:/trae/5.13/video-warehouse';
const backupRoot = path.join(projectRoot, 'backups/2026-06-07-any-migration');

const targets = [
  { src: 'src/hooks/useFetch.ts', dest: 'src/hooks/useFetch.ts' },
  { src: 'src/hooks/useWebVitals.ts', dest: 'src/hooks/useWebVitals.ts' },
  { src: 'src/services/httpClient.ts', dest: 'src/services/httpClient.ts' },
  { src: 'src/services/videoService.ts', dest: 'src/services/videoService.ts' },
  { src: 'src/stores/useNavStore.ts', dest: 'src/stores/useNavStore.ts' },
  { src: 'src/components/UniversalPlayer/hooks/usePlayerCore.ts', dest: 'src/components/UniversalPlayer/hooks/usePlayerCore.ts' },
  { src: 'src/components/PerformanceMonitor/PerformanceMonitor.tsx', dest: 'src/components/PerformanceMonitor/PerformanceMonitor.tsx' },
  { src: 'src/pages/Detail/index.tsx', dest: 'src/pages/Detail/index.tsx' },
  { src: 'src/pages/Collections/index.tsx', dest: 'src/pages/Collections/index.tsx' },
  { src: 'src/pages/History/index.tsx', dest: 'src/pages/History/index.tsx' },
  { src: 'src/components/VideoCard/VideoCard.tsx', dest: 'src/components/VideoCard/VideoCard.tsx' },
  { src: 'src/components/UniversalPlayer/UniversalPlayer.tsx', dest: 'src/components/UniversalPlayer/UniversalPlayer.tsx' },
  { src: 'src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.tsx', dest: 'src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.tsx' },
  { src: 'src/components/DailyPicks/DailyPicks.tsx', dest: 'src/components/DailyPicks/DailyPicks.tsx' },
  { src: 'src/components/IPTVChannelCard/IPTVChannelCard.tsx', dest: 'src/components/IPTVChannelCard/IPTVChannelCard.tsx' },
  { src: 'src/components/TMDBMovieRow/index.tsx', dest: 'src/components/TMDBMovieRow/index.tsx' },
  { src: 'src/components/FilterBar/FilterBar.tsx', dest: 'src/components/FilterBar/FilterBar.tsx' },
  { src: 'src/components/Layout/HeaderContext.tsx', dest: 'src/components/Layout/HeaderContext.tsx' },
  { src: 'src/components/ui/Toast.tsx', dest: 'src/components/ui/Toast.tsx' },
  { src: 'src/pages/IPTV/Player.tsx', dest: 'src/pages/IPTV/Player.tsx' },
  { src: 'src/pages/IPTV/IPTVPlayer.tsx', dest: 'src/pages/IPTV/IPTVPlayer.tsx' },
  { src: 'src/pages/IPTV/index.tsx', dest: 'src/pages/IPTV/index.tsx' },
  { src: 'src/pages/Player/index.tsx', dest: 'src/pages/Player/index.tsx' },
];

let copied = 0;
for (const t of targets) {
  const srcPath = path.join(projectRoot, t.src);
  const destPath = path.join(backupRoot, t.dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`SKIP (not found): ${t.src}`);
    continue;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  copied++;
}

const manifestLines = [
  '# 备份清单（2026-06-07 any 迁移 + Hooks 修复 + 文件拆分）',
  '',
  '> 创建时间：2026-06-07',
  '> 原因：方案 C 实施 — 全量严格执行 eslint no-explicit-any + react-hooks/exhaustive-deps + react-refresh/only-export-components',
  '> 文件数：' + copied + ' 个',
  '',
  '## 备份路径',
  '',
  '所有文件已复制到 backups/2026-06-07-any-migration/ 目录，保持与原路径一致的相对路径。',
  '',
  '## 文件清单',
  '',
];
for (const t of targets) {
  manifestLines.push('- `' + t.src + '` → `backups/2026-06-07-any-migration/' + t.dest + '`');
}
manifestLines.push('');
manifestLines.push('## 恢复方法');
manifestLines.push('');
manifestLines.push('单文件恢复（PowerShell）：');
manifestLines.push('');
manifestLines.push('    Copy-Item "backups/2026-06-07-any-migration/<相对路径>" "<原路径>"');
manifestLines.push('');
manifestLines.push('单文件恢复（bash）：');
manifestLines.push('');
manifestLines.push('    cp "backups/2026-06-07-any-migration/<相对路径>" "<原路径>"');
manifestLines.push('');
manifestLines.push('## 删除原因说明');
manifestLines.push('');
manifestLines.push('本次为代码改进而非废弃文件删除，不影响项目运行。如需回滚，参照上述恢复方法。');
manifestLines.push('');
const manifest = manifestLines.join('\n');

fs.writeFileSync(path.join(backupRoot, 'backup-manifest.md'), manifest);
console.log(`Copied ${copied} files to ${backupRoot}`);
console.log(`Manifest: ${path.join(backupRoot, 'backup-manifest.md')}`);
