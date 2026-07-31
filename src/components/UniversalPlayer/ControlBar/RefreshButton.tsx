import { RefreshCw } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

interface RefreshButtonProps {
  onClick: () => void;
}

export default function RefreshButton({ onClick }: RefreshButtonProps) {
  return (
    <button
      onClick={onClick}
      title="刷新"
    >
      <Icon icon={RefreshCw} size="md" />
    </button>
  );
}
