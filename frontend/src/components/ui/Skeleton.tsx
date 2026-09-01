/**
 * Skeleton — subtle pulse placeholder for loading states.
 * Replaces "Loading..." text + generic spinners with a consistent shimmer.
 */

import { cn } from '../../lib/utils';

export function Skeleton({
  className,
  rounded = 'md',
}: {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}) {
  const radius = {
    sm: 'rounded-[var(--radius-sm)]',
    md: 'rounded-[var(--radius-md)]',
    lg: 'rounded-[var(--radius-lg)]',
    full: 'rounded-full',
  }[rounded];
  return (
    <div
      className={cn(
        'animate-pulse bg-zinc-200/70 dark:bg-zinc-800/70',
        radius,
        className
      )}
      aria-hidden
    />
  );
}

/** Skeleton list — convenience for repo / conversation lists. */
export function SkeletonList({
  count = 3,
  height = 'h-12',
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full', height)} />
      ))}
    </div>
  );
}