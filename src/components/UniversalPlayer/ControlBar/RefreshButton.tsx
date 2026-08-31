import { RefreshCw, RefreshCcw } from 'lucide-react';
import { DuoIcon } from '@/components/ui/DuoIcon';

interface RefreshButtonProps {
  onClick: () => void;
}

export default function RefreshButton({ onClick }: RefreshButtonProps) {
  return (
    <button
      onClick={onClick}
      title="刷新"
    >
      <DuoIcon primary={RefreshCw} secondary={RefreshCcw} size="md" />
    </button>
  );
}
