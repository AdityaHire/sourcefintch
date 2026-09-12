/**
 * Modal — Apple Design refined presentation.
 *
 * Principles:
 * - Interruptible critically damped spring motion
 * - Symmetric enter/exit trajectory
 * - Translucent material with specular highlight edge
 * - Instant dismiss response on ESC or backdrop
 */

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { appleSprings, haptics } from '../../lib/applePhysics';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** disable backdrop click (for blocking confirmations) */
  persistent?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  persistent,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) {
        haptics.trigger('light');
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, persistent]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => {
            if (!persistent) {
              haptics.trigger('light');
              onClose();
            }
          }}
        >
          <motion.div
            key="modal-panel"
            className={cn(
              'w-full rounded-[var(--radius-xl)] border border-zinc-200/80 dark:border-white/[0.08]',
              'border-t-white/90 dark:border-t-white/20',
              'bg-white/95 dark:bg-[#111215]/95 backdrop-blur-2xl backdrop-saturate-180 p-6',
              'shadow-2xl shadow-black/20 font-sans-ui max-h-[85vh] overflow-y-auto select-text',
              sizes[size]
            )}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={appleSprings.modal}
            style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {title && (
              <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-white/[0.06] pb-3 select-none">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
                <button
                  type="button"
                  onClick={() => {
                    haptics.trigger('light');
                    onClose();
                  }}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors active:scale-95 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}