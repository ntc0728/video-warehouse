import { Camera } from 'lucide-react';

interface ScreenshotButtonProps {
  onClick: () => void;
}

export default function ScreenshotButton({ onClick }: ScreenshotButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      className="up-popover-item"
      onClick={handleClick}
      title="截图 (S)"
    >
      <Camera size={16} />
      <span>截图</span>
    </button>
  );
}
