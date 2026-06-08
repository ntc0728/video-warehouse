import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onClick: () => void;
}

export default function RefreshButton({ onClick }: RefreshButtonProps) {
  return (
    <button
      className="up-control-btn"
      onClick={onClick}
      title="刷新"
    >
      <RefreshCw size={20} />
    </button>
  );
}
