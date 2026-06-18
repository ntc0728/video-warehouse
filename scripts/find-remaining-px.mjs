// 查找剩余的 px 错误位置
import { readFileSync } from 'fs';

const files = [
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

const TARGET = ['font-size','padding','padding-top','padding-right','padding-bottom','padding-left','margin','margin-top','margin-right','margin-bottom','margin-left','gap','row-gap','column-gap','width','min-width','max-width','height','min-height','max-height','top','right','bottom','left','border-radius','inset'];

let total = 0;
for (const f of files) {
  const c = readFileSync(f, 'utf8');
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const p of TARGET) {
      const re = new RegExp('\\b' + p + '\\s*:\\s*([^;{}]+)');
      const m = lines[i].match(re);
      if (m && /\b\d+px\b/.test(m[1])) {
        console.log(`${f}:${i+1} [${p}]: ${m[1].trim()}`);
        total++;
      }
    }
  }
}
console.log(`\nTotal remaining px in target props: ${total}`);
