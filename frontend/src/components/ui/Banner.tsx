/**
 * Banner — slide-down inline alert (info/warning/error).
 * Smooth in/out, dismissable, consistent across the app.
 */

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'error' | 'warning' | 'info';

const toneClasses: Record<Tone, string> = {
  error:
    'border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/[0.06] text-rose-900 dark:text-rose-200',
  warning:
    'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] text-amber-900 dark:text-amber-200',
  info:
    'border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/[0.06] text-indigo-900 dark:text-indigo-200',
};

const dismissClasses: Record<Tone, string> = {
  error: 'text-rose-500 hover:text-rose-700 dark:hover:text-rose-100',
  warning: 'text-amber-500 hover:text-amber-700 dark:hover:text-amber-100',
  info: 'text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-100',
};

export function Banner({
  show,
  onDismiss,
  tone = 'info',
  children,
}: {
  show: boolean;
  onDismiss?: () => void;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'overflow-hidden border-b text-xs font-sans-ui shrink-0',
            toneClasses[tone]
          )}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
            <span>{children}</span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className={cn(
                  'cursor-pointer ml-3 font-semibold transition-colors',
                  dismissClasses[tone]
                )}
              >
                Dismiss
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}