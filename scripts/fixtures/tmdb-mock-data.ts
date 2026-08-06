/**
 * TMDB API Mock 数据
 *
 * 拦截所有 api.tmdb.org 请求，返回缓存的 mock 数据，
 * 避免测试过程中大量调用真实 TMDB API 导致 Token 被封禁。
 *
 * 数据来源：从真实 API 响应中提取的代表性样本。
 */

// ── 通用响应模板 ──────────────────────────────────────────

const makePage = (results: unknown[], totalResults = 100) => ({
  page: 1,
  results,
  total_pages: Math.ceil(totalResults / 20),
  total_results: totalResults,
});

// ── Trending 响应 ─────────────────────────────────────────

const TRENDING_RESULTS = Array.from({ length: 20 }, (_, i) => ({
  id: 1000 + i,
  title: `测试电影 ${i + 1}`,
  name: `测试剧集 ${i + 1}`,
  overview: `这是测试电影/剧集 ${i + 1} 的简介，用于验证首页 trending 数据渲染。`,
  poster_path: `/test-poster-${i}.jpg`,
  backdrop_path: `/test-backdrop-${i}.jpg`,
  release_date: `2024-0${(i % 9) + 1}-15`,
  first_air_date: `2024-0${(i % 9) + 1}-15`,
  vote_average: +(7 + (i % 3) * 0.5).toFixed(1),
  vote_count: 1000 + i * 100,
  media_type: i % 2 === 0 ? 'movie' : 'tv',
  genre_ids: [28, 12],
  popularity: 100 + i * 10,
  original_language: 'en',
}));

// ── Movie Detail 响应 ─────────────────────────────────────

const MOVIE_DETAIL = {
  id: 550,
  title: '搏击俱乐部',
  original_title: 'Fight Club',
  overview: '一个绝望的白领和一个肥皂销售员组建了一个地下搏击俱乐部，演变成远超他们想象的东西。',
  poster_path: '/test-movie-poster.jpg',
  backdrop_path: '/test-movie-backdrop.jpg',
  release_date: '1999-10-15',
  vote_average: 8.4,
  vote_count: 28000,
  runtime: 139,
  genres: [{ id: 18, name: '剧情' }, { id: 53, name: '惊悚' }],
  status: 'Released',
  original_language: 'en',
  spoken_languages: [{ name: 'English', english_name: 'English' }],
  production_countries: [{ name: '美国' }],
  production_companies: [{ id: 1, name: '20th Century Fox', logo_path: '/test-logo.png' }],
  homepage: 'https://example.com',
  tagline: 'Mischief. Mayhem. Soap.',
  images: {
    logos: [{ iso_639_1: 'en', file_path: '/test-logo.png' }],
    backdrops: Array.from({ length: 8 }, (_, i) => ({ file_path: `/test-backdrop-${i}.jpg` })),
  },
  credits: {
    cast: Array.from({ length: 12 }, (_, i) => ({
      id: 2000 + i,
      name: `演员 ${i + 1}`,
      character: `角色 ${i + 1}`,
      profile_path: `/test-cast-${i}.jpg`,
    })),
    crew: [{ job: 'Director', name: '大卫·芬奇' }],
  },
  similar: { results: TRENDING_RESULTS.slice(0, 6) },
  recommendations: { results: TRENDING_RESULTS.slice(6, 12) },
};

// ── TV Detail 响应 ────────────────────────────────────────

const TV_DETAIL = {
  id: 1399,
  name: '权力的游戏',
  original_name: 'Game of Thrones',
  overview: '七个贵族家族在一个史诗般的维斯特洛大陆上争夺铁王座的控制权。',
  poster_path: '/test-tv-poster.jpg',
  backdrop_path: '/test-tv-backdrop.jpg',
  first_air_date: '2011-04-17',
  vote_average: 8.4,
  vote_count: 22000,
  episode_run_time: [60],
  genres: [{ id: 10765, name: '科幻奇幻' }, { id: 18, name: '剧情' }],
  status: 'Ended',
  original_language: 'en',
  spoken_languages: [{ name: 'English', english_name: 'English' }],
  production_countries: [{ name: '美国' }],
  production_companies: [{ id: 2, name: 'HBO', logo_path: '/test-hbo-logo.png' }],
  homepage: 'https://example.com',
  tagline: 'Winter is Coming',
  number_of_seasons: 8,
  number_of_episodes: 73,
  in_production: false,
  last_air_date: '2019-05-19',
  created_by: [{ name: '大卫·贝尼奥夫' }],
  seasons: Array.from({ length: 9 }, (_, i) => ({
    id: 3000 + i,
    name: i === 0 ? '特别篇' : `第 ${i} 季`,
    season_number: i,
    episode_count: i === 0 ? 0 : 10,
    air_date: `201${i}-04-17`,
    overview: `第 ${i} 季简介`,
    poster_path: `/test-season-${i}.jpg`,
  })),
  images: {
    logos: [{ iso_639_1: 'en', file_path: '/test-tv-logo.png' }],
    backdrops: Array.from({ length: 6 }, (_, i) => ({ file_path: `/test-tv-backdrop-${i}.jpg` })),
  },
  credits: {
    cast: Array.from({ length: 10 }, (_, i) => ({
      id: 2100 + i,
      name: `演员 ${i + 1}`,
      character: `角色 ${i + 1}`,
      profile_path: `/test-tv-cast-${i}.jpg`,
    })),
    crew: [{ job: 'Director', name: '导演' }],
  },
  similar: { results: TRENDING_RESULTS.slice(0, 6) },
  recommendations: { results: TRENDING_RESULTS.slice(6, 12) },
};

// ── Person Detail 响应 ────────────────────────────────────

const PERSON_DETAIL = {
  id: 128,
  name: '刘德华',
  also_known_as: ['Andy Lau', '刘德华'],
  birthday: '1961-09-27',
  deathday: null,
  place_of_birth: '中国香港新界大埔区泰亨村',
  biography: '刘德华，1961年9月27日出生于中国香港，华语影视男演员、歌手、词作人、制片人。被誉为"四大天王"之一。',
  profile_path: '/test-person-avatar.jpg',
};

const PERSON_MOVIE_CREDITS = {
  cast: Array.from({ length: 25 }, (_, i) => ({
    id: 4000 + i,
    title: `刘德华电影 ${i + 1}`,
    poster_path: `/test-person-movie-${i}.jpg`,
    overview: `电影简介 ${i + 1}`,
    release_date: `20${10 + (i % 14)}-01-15`,
    vote_average: +(7 + (i % 3) * 0.5).toFixed(1),
    popularity: 100 - i,
  })),
};

const PERSON_TV_CREDITS = {
  cast: Array.from({ length: 5 }, (_, i) => ({
    id: 5000 + i,
    name: `刘德华剧集 ${i + 1}`,
    poster_path: `/test-person-tv-${i}.jpg`,
    overview: `剧集简介 ${i + 1}`,
    first_air_date: `20${15 + i}-06-01`,
    vote_average: +(7.5 + (i % 2) * 0.3).toFixed(1),
    popularity: 80 - i * 5,
  })),
};

// ── Search 响应 ───────────────────────────────────────────

const SEARCH_RESULTS = makePage(
  TRENDING_RESULTS.slice(0, 10).map((item) => ({
    ...item,
    media_type: item.media_type,
  })),
  42,
);

// ── Discover 响应 ─────────────────────────────────────────

const DISCOVER_RESULTS = makePage(TRENDING_RESULTS.slice(0, 20), 42461);

// ── Genres 响应 ───────────────────────────────────────────

const MOVIE_GENRES = {
  genres: [
    { id: 28, name: '动作' }, { id: 12, name: '冒险' }, { id: 16, name: '动画' },
    { id: 35, name: '喜剧' }, { id: 80, name: '犯罪' }, { id: 99, name: '纪录片' },
    { id: 18, name: '剧情' }, { id: 10751, name: '家庭' }, { id: 14, name: '奇幻' },
    { id: 36, name: '历史' }, { id: 27, name: '恐怖' }, { id: 10402, name: '音乐' },
    { id: 9648, name: '悬疑' }, { id: 10749, name: '爱情' }, { id: 878, name: '科幻' },
    { id: 10770, name: '电视电影' }, { id: 53, name: '惊悚' }, { id: 10752, name: '战争' },
    { id: 37, name: '西部' },
  ],
};

const TV_GENRES = {
  genres: [
    { id: 10759, name: '动作冒险' }, { id: 16, name: '动画' }, { id: 35, name: '喜剧' },
    { id: 80, name: '犯罪' }, { id: 99, name: '纪录片' }, { id: 18, name: '剧情' },
    { id: 10751, name: '家庭' }, { id: 10762, name: '儿童' }, { id: 9648, name: '悬疑' },
    { id: 10763, name: '新闻' }, { id: 10764, name: '真人秀' }, { id: 10765, name: '科幻奇幻' },
    { id: 10766, name: '肥皂剧' }, { id: 10767, name: '脱口秀' }, { id: 10768, name: '战争政治' },
  ],
};

// ── Images 响应 ───────────────────────────────────────────

const MOVIE_IMAGES = {
  backdrops: Array.from({ length: 10 }, (_, i) => ({ file_path: `/test-backdrop-${i}.jpg` })),
  posters: Array.from({ length: 5 }, (_, i) => ({ file_path: `/test-poster-${i}.jpg` })),
};

const TV_IMAGES = {
  backdrops: Array.from({ length: 8 }, (_, i) => ({ file_path: `/test-tv-backdrop-${i}.jpg` })),
  posters: Array.from({ length: 4 }, (_, i) => ({ file_path: `/test-tv-poster-${i}.jpg` })),
};

// ── 路由匹配规则 ─────────────────────────────────────────

export interface MockRoute {
  pattern: RegExp | string;
  response: unknown;
}

/**
 * TMDB API mock 路由表
 * 按优先级排列，第一个匹配的规则生效
 */
export const TMDB_MOCK_ROUTES: MockRoute[] = [
  // Trending
  { pattern: /\/trending\//, response: makePage(TRENDING_RESULTS) },

  // Search
  { pattern: /\/search\/multi/, response: SEARCH_RESULTS },
  { pattern: /\/search\//, response: SEARCH_RESULTS },

  // Discover
  { pattern: /\/discover\/movie/, response: DISCOVER_RESULTS },
  { pattern: /\/discover\/tv/, response: DISCOVER_RESULTS },

  // 首页 8 区块（2026-08-06 补充：此前只有 trending 有 mock，其余区块命中 fallback
  // 返回空数组 → 首页仅 trending 行有数据，TMDBMovieRow 箭头等依赖「行溢出」的
  // 断言无法在 mock 下验证（HOME-050/HOME-054 均检测不到箭头）。补齐后首页
  // 全部区块都有数据，箭头/继续观看等测试可稳定断言。）
  { pattern: /\/movie\/now_playing/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/movie\/popular/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/movie\/top_rated/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/movie\/upcoming/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/tv\/popular/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/tv\/top_rated/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/tv\/airing_today/, response: makePage(TRENDING_RESULTS) },
  { pattern: /\/trending\/all\/day/, response: makePage(TRENDING_RESULTS) },

  // Movie / TV similar & recommendations（独立端点，须放在通用 /movie/\d+ 之前优先匹配）
  { pattern: /\/movie\/\d+\/similar/, response: makePage(TRENDING_RESULTS.slice(0, 6)) },
  { pattern: /\/movie\/\d+\/recommendations/, response: makePage(TRENDING_RESULTS.slice(6, 12)) },
  { pattern: /\/tv\/\d+\/similar/, response: makePage(TRENDING_RESULTS.slice(0, 6)) },
  { pattern: /\/tv\/\d+\/recommendations/, response: makePage(TRENDING_RESULTS.slice(6, 12)) },

  // Movie / TV images（独立端点，须放在通用 /movie/\d+ /tv/\d+ 详情路由之前优先匹配，
  // 否则 /movie/550/images 会被 /\/movie\/550(?![\d])/ 误匹配成详情响应）
  { pattern: /\/movie\/\d+\/images/, response: MOVIE_IMAGES },
  { pattern: /\/tv\/\d+\/images/, response: TV_IMAGES },

  // Movie detail
  { pattern: /\/movie\/550(?![\d])/, response: MOVIE_DETAIL },
  { pattern: /\/movie\/\d+/, response: MOVIE_DETAIL },

  // TV detail
  { pattern: /\/tv\/1399(?![\d])/, response: TV_DETAIL },
  { pattern: /\/tv\/\d+/, response: TV_DETAIL },

  // Person
  // 注意：movie_credits / tv_credits 必须排在 person/128 之前——
  // /person/128/movie_credits 若先匹配 person/128(?![\d])（128 后是 / 非数字，
  // lookahead 通过）会返回 PERSON_DETAIL（无 cast 字段）→ 组件读取 cast 报错。
  { pattern: /\/person\/\d+\/movie_credits/, response: PERSON_MOVIE_CREDITS },
  { pattern: /\/person\/\d+\/tv_credits/, response: PERSON_TV_CREDITS },
  { pattern: /\/person\/128(?![\d])/, response: PERSON_DETAIL },
  { pattern: /\/person\/\d+/, response: PERSON_DETAIL },

  // Genres
  { pattern: /\/genre\/movie\/list/, response: MOVIE_GENRES },
  { pattern: /\/genre\/tv\/list/, response: TV_GENRES },

  // Fallback: 兜底返回空列表
  { pattern: /api\.tmdb\.org/, response: makePage([]) },
];

/**
 * 匹配 URL 到对应的 mock 响应
 */
export function matchMockRoute(url: string): unknown | null {
  for (const route of TMDB_MOCK_ROUTES) {
    if (typeof route.pattern === 'string') {
      if (url.includes(route.pattern)) return route.response;
    } else {
      if (route.pattern.test(url)) return route.response;
    }
  }
  return null;
}
