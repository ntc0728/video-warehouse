import { usePlayerStore } from '@/stores';

const RATIO_OPTIONS = ['default', '4:3', '16:9', 'fill'] as const;
const RATIO_LABELS: Record<string, string> = {
  default: '默认',
  '4:3': '4:3',
  '16:9': '16:9',
  fill: '铺满',
};

export default function RatioButton() {
  const aspectRatio = usePlayerStore(s => s.aspectRatio);
  const setAspectRatio = usePlayerStore(s => s.setAspectRatio);

  const cycleRatio = () => {
    const idx = RATIO_OPTIONS.indexOf(aspectRatio);
    const next = RATIO_OPTIONS[(idx + 1) % RATIO_OPTIONS.length];
    setAspectRatio(next);
  };

  return (
    <button className="up-popover-item" onClick={cycleRatio}>
      视频比例: {RATIO_LABELS[aspectRatio]}
    </button>
  );
}
