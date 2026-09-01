/**
 * StatusDot — single source of truth for status indicators across the app.
 * Replaces ad-hoc dot+label combos scattered through Sidebar, WorkspacePage,
 * and ServiceStatusCard.
 */

import { cn } from '../../lib/utils';

type Status = 'online' | 'checking' | 'failed' | 'muted';

const dotClass: Record<Status, string> = {
  online: 'status-dot status-dot--online',
  checking: 'status-dot status-dot--checking',
  failed: 'status-dot status-dot--failed',
  muted: 'status-dot status-dot--muted',
};

const labelClass: Record<Status, string> = {
  online: 'text-emerald-600 dark:text-emerald-400',
  checking: 'text-amber-600 dark:text-amber-400',
  failed: 'text-rose-600 dark:text-rose-400',
  muted: 'text-zinc-500 dark:text-zinc-400',
};

export interface StatusDotProps {
  status: Status;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export function StatusDot({
  status,
  label,
  className,
  showLabel = true,
}: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <span className={dotClass[status]} aria-hidden />
      {showLabel && label && (
        <span className={cn(labelClass[status])}>{label}</span>
      )}
    </span>
  );
}