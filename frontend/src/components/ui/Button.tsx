/**
 * Button — Apple Design refined single source of truth for buttons.
 *
 * Principles:
 * - Instant feedback on press (scale 0.97, 60ms)
 * - Translucent materials & depth with specular top edge on solid buttons
 * - Harmonic sizing & spacing
 * - Tactile feel and accessible focus ring
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { haptics } from '../../lib/applePhysics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
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
  'disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none ' +
  'active:scale-[0.97] active:duration-60 active:transition-transform';

const variants: Record<Variant, string> = {
  primary:
    'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 ' +
    'hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-xs border-t border-t-white/20 dark:border-t-white/50',
  secondary:
    'border border-zinc-200/90 dark:border-white/[0.08] bg-white/90 dark:bg-zinc-900/80 ' +
    'text-zinc-700 dark:text-zinc-300 ' +
    'hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-white/[0.15] ' +
    'shadow-2xs backdrop-blur-sm border-t-white/60 dark:border-t-white/15',
  glass:
    'border border-zinc-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.05] ' +
    'text-zinc-800 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-white/[0.1] ' +
    'backdrop-blur-md backdrop-saturate-180 shadow-2xs border-t-white/60 dark:border-t-white/20',
  ghost:
    'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white ' +
    'hover:bg-zinc-100/80 dark:hover:bg-white/[0.06]',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 shadow-xs border-t border-t-white/25',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', iconOnly, className, onClick, ...rest }, ref) => (
    <button
      ref={ref}
      onClick={(e) => {
        haptics.trigger('light');
        onClick?.(e);
      }}
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