/**
 * Card — canonical surface for grouped content.  Replaces the mixed
 * `rounded-2xl border border-zinc-200 bg-white shadow-xs` patterns
 * scattered across components.
 */

import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
  /** visual surface tint */
  tone?: 'default' | 'muted' | 'subtle';
}

const padMap = { sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;

const toneMap = {
  default:
    'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800',
  muted:
    'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800',
  subtle:
    'bg-white/70 dark:bg-zinc-950/60 border-zinc-200/80 dark:border-zinc-800/60 backdrop-blur-md',
} as const;

export function Card({
  className,
  padding = 'md',
  tone = 'default',
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border shadow-2xs',
        toneMap[tone],
        padMap[padding],
        className
      )}
      {...rest}
    />
  );
}