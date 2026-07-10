import { PictureInPicture2 } from 'lucide-react';

interface PiPButtonProps {
  isPiP: boolean;
  onClick: () => void;
}

export default function PiPButton({ isPiP, onClick }: PiPButtonProps) {
  const supported = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;
  if (!supported) return null;

  return (
    <button
      onClick={onClick}
      title="画中画 (P)"
      aria-label={isPiP ? '退出画中画' : '画中画'}
      aria-pressed={isPiP}
    >
      <PictureInPicture2 size={20} />
    </button>
  );
}
