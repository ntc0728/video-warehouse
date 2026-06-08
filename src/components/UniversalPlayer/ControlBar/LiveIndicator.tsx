interface LiveIndicatorProps {
  visible: boolean;
}

export default function LiveIndicator({ visible }: LiveIndicatorProps) {
  if (!visible) return null;
  return (
    <div className="up-live-indicator">
      <span className="up-live-dot" />
      LIVE
    </div>
  );
}
