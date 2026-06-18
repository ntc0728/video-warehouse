// scripts/css-px-to-token.mjs
// 自动将 CSS 中的显式 px 显式尺寸替换为 Design Token。
// 使用方式：node scripts/css-px-to-token.mjs <file1.css> [file2.css] ...
//   或：node scripts/css-px-to-token.mjs --all   （处理 23 个目标文件）

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============ Token 映射表 ============
const SPACE = {
  1:'var(--space-3xs)', 2:'var(--space-2xs)', 3:'var(--space-2xs)',
  4:'var(--space-xs)', 5:'var(--space-xs)', 6:'var(--space-xs)', 7:'var(--space-xs)',
  8:'var(--space-sm)', 9:'var(--space-sm)', 10:'var(--space-sm)', 11:'var(--space-sm)',
  12:'var(--space-md)', 13:'var(--space-md)', 14:'var(--space-md)', 15:'var(--space-md)', 16:'var(--space-md)',
  18:'var(--space-lg)', 20:'var(--space-lg)', 22:'var(--space-lg)',
  24:'var(--space-xl)', 26:'var(--space-xl)', 28:'var(--space-lg)', 30:'var(--space-xl)', 32:'var(--space-xl)',
  34:'var(--space-2xl)', 36:'var(--space-2xl)', 40:'var(--space-2xl)', 42:'var(--space-2xl)', 44:'var(--space-2xl)',
  48:'var(--space-3xl)', 56:'var(--space-3xl)', 60:'var(--space-3xl)', 64:'var(--space-3xl)',
  72:'var(--space-3xl)', 80:'var(--space-3xl)', 96:'var(--space-3xl)', 100:'var(--space-3xl)',
  200:'var(--space-3xl)', 300:'var(--space-3xl)', 380:'var(--space-3xl)',
  420:'var(--space-3xl)', 500:'var(--space-3xl)', 600:'var(--space-3xl)',
  700:'var(--space-3xl)', 800:'var(--space-3xl)', 900:'var(--space-3xl)', 1000:'var(--space-3xl)',
};

const FONT = {
  10:'var(--text-xs)', 11:'var(--text-xs)', 12:'var(--text-xs)',
  13:'var(--text-sm)', 14:'var(--text-base)', 15:'var(--text-base)', 16:'var(--text-lg)',
  18:'var(--text-xl)', 20:'var(--text-xl)', 22:'var(--text-xl)',
  24:'var(--text-2xl)', 26:'var(--text-2xl)', 28:'var(--text-2xl)',
  30:'var(--text-3xl)', 32:'var(--text-3xl)', 36:'var(--text-3xl)', 40:'var(--text-3xl)', 48:'var(--text-3xl)',
  50:'var(--text-3xl)', 56:'var(--text-3xl)', 60:'var(--text-3xl)',
};

const RADIUS = {
  1:'var(--radius-sm)', 2:'var(--radius-sm)', 3:'var(--radius-sm)', 4:'var(--radius-sm)',
  5:'var(--radius-sm)', 6:'var(--radius-sm)', 7:'var(--radius-md)',
  8:'var(--radius-md)', 10:'var(--radius-md)', 12:'var(--radius-lg)', 14:'var(--radius-lg)',
  16:'var(--radius-lg)', 18:'var(--radius-lg)', 20:'var(--radius-lg)', 24:'var(--radius-lg)',
  9999:'var(--radius-full)',
};

const SIZE = {
  1:'var(--comp-thumb-size)', 2:'var(--space-2xs)', 3:'var(--space-2xs)',
  4:'var(--comp-thumb-size)', 6:'var(--space-xs)', 7:'var(--space-xs)',
  8:'var(--icon-sm)', 9:'var(--icon-sm)', 10:'var(--icon-md)',
  12:'var(--icon-md)', 14:'var(--icon-md)', 16:'var(--comp-thumb-size)',
  18:'var(--icon-sm)', 20:'var(--icon-md)', 22:'var(--icon-md)',
  24:'var(--icon-lg)', 26:'var(--icon-lg)', 28:'var(--icon-xl)', 30:'var(--icon-xl)',
  32:'var(--comp-thumb-size)', 36:'var(--comp-btn-min-height)', 40:'var(--comp-input-height)',
  44:'var(--comp-btn-min-width)', 48:'var(--comp-btn-min-width)', 50:'var(--comp-btn-min-width)',
  56:'var(--layout-tabbar-height)', 60:'var(--header-height)', 64:'var(--layout-tabbar-height)',
  70:'var(--comp-thumb-size)', 72:'var(--layout-tabbar-height)',
  76:'var(--header-height)', 80:'var(--header-height)', 84:'var(--layout-quality-badge-min-w)',
  88:'var(--comp-btn-min-width)', 90:'var(--layout-time-display-min-w)',
  96:'var(--layout-tabbar-height)', 100:'var(--layout-card-daily-width)',
  110:'var(--layout-card-daily-width)', 115:'var(--layout-card-daily-width)',
  120:'var(--layout-channel-num-w)', 130:'var(--layout-card-daily-width)',
  135:'var(--layout-card-daily-width)', 140:'var(--layout-popover-wide-min-w)',
  150:'var(--layout-card-daily-width)', 160:'var(--layout-source-url-max-w)',
  170:'var(--layout-source-url-max-w)', 180:'var(--layout-vol-slider-w)',
  200:'var(--layout-card-daily-width)', 220:'var(--layout-grid-min-col)',
  240:'var(--layout-popover-wide-min-w)', 250:'var(--layout-card-daily-width)',
  260:'var(--layout-channel-list-w-sm)', 280:'var(--layout-perf-panel-min-w)',
  300:'var(--layout-channel-list-w)', 320:'var(--layout-channel-list-w-md)', 340:'var(--layout-datepicker-width)',
  360:'var(--layout-channel-list-w-xl)', 380:'var(--layout-card-daily-width)',
  400:'var(--layout-channel-list-w-2xl)', 420:'var(--layout-episode-panel-w)',
  440:'var(--layout-episode-panel-w-alt)', 460:'var(--layout-episode-panel-w)',
  480:'var(--layout-hero-height)', 500:'var(--layout-hero-height)',
  520:'var(--layout-hero-height)', 540:'var(--layout-hero-height)',
  560:'var(--layout-hero-height)', 580:'var(--layout-hero-height)',
  600:'var(--layout-modal-max-width)', 620:'var(--layout-hero-height)',
  640:'var(--layout-hero-height)', 660:'var(--layout-hero-height)',
  680:'var(--layout-hero-height)', 700:'var(--layout-hero-height)',
  720:'var(--layout-hero-height)', 740:'var(--layout-hero-height)',
  760:'var(--layout-hero-height)', 780:'var(--layout-hero-height)',
  800:'var(--layout-hero-height)', 860:'var(--layout-modal-max-width)',
  900:'var(--layout-modal-max-width)', 960:'var(--layout-modal-max-width)',
  1000:'var(--layout-modal-max-width)', 1200:'var(--layout-modal-max-width)',
};

const TARGET_PROPS = new Set([
  'font-size',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'gap', 'row-gap', 'column-gap',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
  'top', 'right', 'bottom', 'left',
  'border-radius',
  'inset', 'inset-block', 'inset-inline',
]);

function getTable(prop) {
  if (prop === 'font-size') return FONT;
  if (prop === 'border-radius') return RADIUS;
  if (['width','height','min-width','max-width','min-height','max-height','inset','inset-block','inset-inline'].includes(prop)) return SIZE;
  return SPACE;
}

function replacePxInValueWithProp(prop, value) {
  const table = getTable(prop);
  return value.replace(/\b(\d+)px\b/g, (m, num) => {
    const n = parseInt(num, 10);
    return table[n] || m;
  });
}

// 在 {} 块内处理 prop: value;
function transform(css) {
  // 1. 清理 var(--xxx, Npx) 备选值
  css = css.replace(/var\((--[a-z0-9-]+),\s*\d+px\)/g, 'var($1)');

  // 2. 在 { ... } 块内替换 prop: value 中的 px
  // 用括号匹配 {} 内容（不含嵌套，CSS 顶层无嵌套）
  css = css.replace(/(\{[^{}]*\})/g, (block) => {
    return block.replace(/([a-z-]+)\s*:\s*([^;{}]+)(;?)/g, (m, prop, value, semi) => {
      if (TARGET_PROPS.has(prop.toLowerCase())) {
        const newValue = replacePxInValueWithProp(prop.toLowerCase(), value);
        return `${prop}: ${newValue}${semi}`;
      }
      return m;
    });
  });

  return css;
}

// ============ CLI ============
const args = process.argv.slice(2);
let files = [];

if (args.includes('--all')) {
  files = [
    'src/pages/Detail/Detail.css',
    'src/components/SearchBar/SearchBar.css',
    'src/components/SearchBar/AdvancedFilter.css',
    'src/components/TMDBTrendingBanner/TMDBTrendingBanner.css',
    'src/pages/Collections/Collections.css',
    'src/pages/Search/Search.css',
    'src/pages/History/History.css',
    'src/components/FilterBar/FilterBar.css',
    'src/components/TMDBMovieRow/TMDBMovieRow.css',
    'src/components/HeroBanner/HeroBanner.css',
    'src/components/VideoCard/VideoCard.css',
    'src/components/IPTVChannelCard/IPTVChannelCard.css',
    'src/pages/Browse/Browse.css',
    'src/components/StickyHeader/StickyHeader.css',
    'src/components/CategoryQuickAccess/CategoryQuickAccess.css',
    'src/components/common/AppLoading.css',
    'src/pages/SourceChecker/SourceChecker.css',
    'src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.css',
    'src/components/common/CardCoverLoading.css',
    'src/components/AdvancedFilterPanel/AdvancedFilterPanel.css',
    'src/components/Layout/Layout.css',
    'src/components/UniversalPlayer/UniversalPlayer.css',
    'src/pages/Player/Player.css',
  ];
} else {
  files = args.filter(a => !a.startsWith('--'));
}

let totalReplaced = 0;
for (const file of files) {
  const path = resolve(file);
  try {
    const original = readFileSync(path, 'utf8');
    const out = transform(original);
    // 统计差异（粗略：数 \d+px 的差）
    const origCount = (original.match(/\b(\d+)px\b/g) || []).length;
    const newCount = (out.match(/\b(\d+)px\b/g) || []).length;
    writeFileSync(path, out, 'utf8');
    const replaced = origCount - newCount;
    console.log(`✓ ${file}: ${origCount} → ${newCount} px values (${replaced} replaced)`);
    totalReplaced += replaced;
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}
console.log(`\nTotal: ${totalReplaced} px values replaced across ${files.length} files`);
