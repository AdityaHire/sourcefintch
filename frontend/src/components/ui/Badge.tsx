/**
 * Badge — pill / chip component used for status, tags, branch names.
 * Single source of truth; use this instead of hand-rolled `rounded-* bg-*-…`
 * spans.
 */

import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral:
    'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 ' +
    'border-zinc-200/80 dark:border-zinc-800',
  muted:
    'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 ' +
    'border-zinc-200/60 dark:border-zinc-800/60',
  success:
    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ' +
    'border-emerald-200 dark:border-emerald-500/30',
  warning:
    'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 ' +
    'border-amber-200 dark:border-amber-500/30',
  danger:
    'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 ' +
    'border-rose-200 dark:border-rose-500/30',
  info:
    'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ' +
    'border-indigo-200 dark:border-indigo-500/30',
};

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ' +
          'text-[11px] font-semibold font-sans-ui whitespace-nowrap',
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}