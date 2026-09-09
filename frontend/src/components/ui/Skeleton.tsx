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
        'relative overflow-hidden bg-zinc-200/60 dark:bg-zinc-800/60',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-white/35 dark:before:via-white/[0.08] before:to-transparent',
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