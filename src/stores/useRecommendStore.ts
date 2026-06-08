/**
 * 每日推荐状态管理
 * 根据视频的类别、标签、年份等属性，从视频库中随机选取每日推荐
 * 并生成与视频特征匹配的个性化推荐理由
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DailyPick {
  id: string;
  videoId: string;
  title: string;
  cover: string;
  reason: string;
  date: string;
}

interface RecommendState {
  dailyPicks: DailyPick[];
  lastGeneratedDate: string;
  generateDailyPicks: (videos: { id: string; title: string; cover: string; type?: string; year?: number; tags?: string[] }[]) => void;
}

// 推荐理由模板，用于无特定上下文时的随机选择
const REASON_TEMPLATES = [
  '年度佳作，不容错过',
  '经典悬疑，烧脑必看',
  '温情治愈系佳作',
  '视觉盛宴，震撼人心',
  '口碑爆棚，好评如潮',
  '剧情反转，出人意料',
  '演技在线，角色鲜活',
  '小众宝藏，值得挖掘',
  '节奏紧凑，全程无尿点',
  '深度思考，回味无穷',
  '轻松幽默，解压之选',
  '史诗巨制，气势恢宏',
];

/**
 * 根据视频的类别、标签和年份生成匹配的推荐理由
 * 优先选择与视频特征相关的理由，无匹配时从通用模板中随机选取
 */
function getReasonByContext(
  type?: string,
  tags?: string[],
  year?: number
): string {
  const candidates: string[] = [];

  if (year && year >= new Date().getFullYear() - 1) {
    candidates.push('年度佳作，不容错过');
  }

  if (type === '悬疑' || tags?.some((t) => t.includes('悬疑') || t.includes('推理'))) {
    candidates.push('经典悬疑，烧脑必看', '剧情反转，出人意料');
  }

  if (type === '喜剧' || tags?.some((t) => t.includes('喜剧') || t.includes('搞笑'))) {
    candidates.push('轻松幽默，解压之选');
  }

  if (tags?.some((t) => t.includes('治愈') || t.includes('温情'))) {
    candidates.push('温情治愈系佳作');
  }

  if (type === '动作' || tags?.some((t) => t.includes('动作') || t.includes('冒险'))) {
    candidates.push('视觉盛宴，震撼人心', '节奏紧凑，全程无尿点');
  }

  if (tags?.some((t) => t.includes('深度') || t.includes('文艺'))) {
    candidates.push('深度思考，回味无穷');
  }

  if (tags?.some((t) => t.includes('史诗') || t.includes('战争'))) {
    candidates.push('史诗巨制，气势恢宏');
  }

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  return REASON_TEMPLATES[Math.floor(Math.random() * REASON_TEMPLATES.length)];
}

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const useRecommendStore = create<RecommendState>()(
  persist(
    (set, get) => ({
      dailyPicks: [],
      lastGeneratedDate: '',

      /**
       * 生成每日推荐
       * 每天仅生成一次，随机选取最多5个视频并为每个视频匹配推荐理由
       */
      generateDailyPicks: (videos) => {
        const today = getTodayString();
        const { lastGeneratedDate } = get();

        // 同一天内不重复生成
        if (lastGeneratedDate === today) return;

        const shuffled = [...videos].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(5, shuffled.length));

        const dailyPicks: DailyPick[] = selected.map((v) => ({
          id: `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          videoId: v.id,
          title: v.title,
          cover: v.cover,
          reason: getReasonByContext(v.type, v.tags, v.year),
          date: today,
        }));

        set({ dailyPicks, lastGeneratedDate: today });
      },
    }),
    {
      name: 'recommend-store',
    }
  )
);
