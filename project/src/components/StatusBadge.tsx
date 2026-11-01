import { type PositionStatus, POSITION_STATUS_CONFIG } from '@/types';

interface StatusBadgeProps {
  status: PositionStatus | undefined;
  size?: 'xs' | 'sm';
  showDot?: boolean;
}

export default function StatusBadge({ status, size = 'sm', showDot = true }: StatusBadgeProps) {
  if (!status) return null;

  const config = POSITION_STATUS_CONFIG[status];
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2.5 py-0.5';

  return (
    <span
      className={`badge ${sizeClass} ${config.color} flex-shrink-0`}
      title={config.description}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />}
      {config.label}
    </span>
  );
}
