import { Camera } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

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
      <Icon icon={Camera} size="sm" />
      <span>截图</span>
    </button>
  );
}
