// Mock injection — create scroll container + arrow buttons + mock cards
(() => {
  const SAMPLE_TITLES = [
    '沙丘：第二部', '奥本海默', '可怜的东西', '蜘蛛侠：纵横宇宙',
    '银河护卫队3', '花月杀手', '好莱坞往事', '信条',
    '阿凡达：水之道', '壮志凌云', '寄生虫', '驾驶舱',
    '瞬息全宇宙', '暗夜骑士', '盗梦空间', '星际穿越',
    '2001太空漫游', '银翼杀手', '黑客帝国', '教父',
  ];

  function buildCard(i) {
    const hue = (i * 47) % 360;
    return '<div class="tmdb-movierow-card" data-mock="' + i + '">'
      + '<div class="video-card">'
      +   '<div class="video-card-cover" style="background:linear-gradient(135deg,hsl(' + hue + ' 65% 50%),hsl(' + ((hue+50)%360) + ' 60% 30%));aspect-ratio:2/3;border-radius:8px;position:relative;display:flex;align-items:flex-end;padding:10px;color:#fff;font-size:12px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.6)">#' + (i+1) + '</div>'
      +   '<div class="video-card-info" style="padding:8px 4px 0">'
      +     '<div class="video-card-title" style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:6px">' + SAMPLE_TITLES[i % SAMPLE_TITLES.length] + '</div>'
      +     '<div class="video-card-meta" style="font-size:11px;opacity:0.65;margin-top:2px">★ 8.' + (i%10) + ' · 2024</div>'
      +   '</div>'
      + '</div>'
    + '</div>';
  }

  let injected = 0;
  const rows = document.querySelectorAll('.tmdb-movierow');
  rows.forEach((row) => {
    // Remove error message if exists
    const err = row.querySelector('.tmdb-movierow-error, .tmdb-movierow-empty, .tmdb-movierow-skeleton');
    if (err) err.remove();

    // Inject left/right arrow buttons into header
    const header = row.querySelector('.tmdb-movierow-header');
    if (header && !header.querySelector('.tmdb-movierow-nav')) {
      const nav = document.createElement('div');
      nav.className = 'tmdb-movierow-nav';
      nav.innerHTML =
        '<button class="tmdb-movierow-arrow tmdb-movierow-arrow-left" aria-label="上一组">‹</button>' +
        '<button class="tmdb-movierow-arrow tmdb-movierow-arrow-right" aria-label="下一组">›</button>';
      header.appendChild(nav);
    }

    // Create scroll container with 14 cards
    if (!row.querySelector('.tmdb-movierow-scroll')) {
      const scroll = document.createElement('div');
      scroll.className = 'tmdb-movierow-scroll';
      for (let i = 0; i < 14; i++) {
        const wrap = document.createElement('div');
        wrap.innerHTML = buildCard(i).trim();
        scroll.appendChild(wrap.firstChild);
      }
      row.appendChild(scroll);
      injected++;
    }
  });
  return 'injected_into_' + injected + '_rows';
})()
