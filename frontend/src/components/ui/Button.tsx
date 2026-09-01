/**
 * Button — single source of truth for all button styles.
 *
 * Variants:
 *   primary   — solid zinc/white inverted (CTA, "Add Repo", "Send")
 *   secondary — bordered ghost on light surface (Copy, Cancel, GitHub)
 *   ghost     — text-only with subtle hover (Dismiss)
 *   danger    — rose for destructive actions
 *
 * Sizes: sm, md (default), lg
 *
 * All variants share the same hover/active timing (100ms) and the same
 * border-radius (var(--radius-sm) = 8px) so the visual rhythm is uniform.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-sans-ui font-semibold rounded-[var(--radius-sm)] ' +
  'transition-[color,background-color,border-color,box-shadow,transform,opacity] ' +
  'duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-zinc-400/40 dark:focus-visible:ring-zinc-500/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ' +
  'active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary:
    'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 ' +
    'hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-xs',
  secondary:
    'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ' +
    'text-zinc-700 dark:text-zinc-300 ' +
    'hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 ' +
    'shadow-2xs',
  ghost:
    'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white ' +
    'hover:bg-zinc-100 dark:hover:bg-zinc-800',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', iconOnly, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        iconOnly && 'aspect-square p-0',
        className
      )}
      {...rest}
    />
  )
);
Button.displayName = 'Button';