import { usePlayerStore } from '@/stores';

export default function MirrorButton() {
  const mirror = usePlayerStore(s => s.mirror);
  const setMirror = usePlayerStore(s => s.setMirror);

  return (
    <button className="up-popover-item" onClick={() => setMirror(!mirror)}>
      镜像画面: {mirror ? '开' : '关'}
    </button>
  );
}
