import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast, type ToastVariant } from '../../contexts/ToastContext';

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastVariant, { border: string; iconColor: string; bg: string }> = {
  success: {
    border: 'border-emerald-500/30 dark:border-emerald-500/40',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-white dark:bg-zinc-900',
  },
  error: {
    border: 'border-rose-500/30 dark:border-rose-500/40',
    iconColor: 'text-rose-500 dark:text-rose-400',
    bg: 'bg-white dark:bg-zinc-900',
  },
  info: {
    border: 'border-indigo-500/30 dark:border-indigo-500/40',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    bg: 'bg-white dark:bg-zinc-900',
  },
};

export function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full sm:w-auto"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          const style = STYLES[toast.variant];

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-xl border shadow-lg backdrop-blur-md text-xs font-sans-ui text-zinc-900 dark:text-zinc-100 ${style.bg} ${style.border}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${style.iconColor}`} />
              <span className="flex-1 leading-snug break-words">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default Toaster;
