import { Camera } from 'lucide-react';

interface ScreenshotButtonProps {
  onClick: () => void;
}

export default function ScreenshotButton({ onClick }: ScreenshotButtonProps) {
  return (
    <button
      className="up-popover-item"
      onClick={onClick}
      title="截图 (S)"
    >
      <Camera size={16} />
      <span>截图</span>
    </button>
  );
}
