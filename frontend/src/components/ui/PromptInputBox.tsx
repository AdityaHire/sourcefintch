/**
 * PromptInputBox — Sourcefinch's chat composer.
 *
 * Features (in scope for Sourcefinch):
 *   - Auto-resizing textarea (grows up to MAX_HEIGHT, then scrolls).
 *   - Enter sends; Shift+Enter inserts a newline.
 *   - Send button reflects state: arrow-up (idle, has text) → spinner (sending)
 *     → square (stop, while a response is streaming).
 *   - Disabled state when no repo is selected OR a response is in flight.
 *   - Token-based light/dark styling (no hardcoded colors).
 *
 * Explicitly NOT included (no backend support):
 *   - Search / Think / Canvas mode toggles
 *   - Image upload / paste / drag-drop
 *   - Voice recording
 *
 * Props are minimal so the parent (ChatInterface) owns the network state.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ArrowUp, Square, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const MAX_HEIGHT = 160; // px — matches previous composer cap
const MIN_HEIGHT = 44; // px — comfortable single-line height

export type ComposerStatus = 'idle' | 'sending' | 'streaming';

export interface PromptInputBoxProps {
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the input is disabled (no repo selected, or in-flight request). */
  disabled?: boolean;
  /** Current status — drives the icon and the right-side button. */
  status: ComposerStatus;
  /** Send handler. Receives the trimmed text. */
  onSend: (text: string) => void;
  /** Stop handler — called when the user clicks the square button while streaming. */
  onStop?: () => void;
  /** Additional classes for the outer wrapper. */
  className?: string;
  /** ARIA label for the textarea. */
  ariaLabel?: string;
}

export interface PromptInputBoxHandle {
  /** Focus the textarea programmatically (used after submit). */
  focus: () => void;
  /** Clear the textarea and reset its height. */
  clear: () => void;
}

export const PromptInputBox = forwardRef<PromptInputBoxHandle, PromptInputBoxProps>(
  function PromptInputBox(
    {
      placeholder = 'Ask anything about this repository...',
      disabled = false,
      status,
      onSend,
      onStop,
      className,
      ariaLabel = 'Chat message',
    },
    ref
  ) {
    const [value, setValue] = useState('');
    const taRef = useRef<HTMLTextAreaElement>(null);

    // ── Auto-resize ────────────────────────────────────────────────────────
    const adjustHeight = useCallback(() => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const next = Math.min(el.scrollHeight, MAX_HEIGHT);
      el.style.height = `${Math.max(next, MIN_HEIGHT - 22)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // ── Imperative handle ──────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        focus: () => taRef.current?.focus(),
        clear: () => {
          setValue('');
          // Reset height in next tick after value updates
          requestAnimationFrame(adjustHeight);
        },
      }),
      [adjustHeight]
    );

    // ── Send / Stop ────────────────────────────────────────────────────────
    const trimmed = value.trim();
    const canSend = trimmed.length > 0 && !disabled && status !== 'sending';

    const handleSend = useCallback(() => {
      if (!canSend) return;
      onSend(trimmed);
      setValue('');
      requestAnimationFrame(adjustHeight);
    }, [canSend, onSend, trimmed, adjustHeight]);

    const handleStop = useCallback(() => {
      onStop?.();
    }, [onStop]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (canSend) handleSend();
        }
      },
      [canSend, handleSend]
    );

    // ── Render ─────────────────────────────────────────────────────────────
    const isStreaming = status === 'streaming';
    const isSending = status === 'sending';

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className={cn(
          'relative flex items-end gap-2',
          'rounded-[var(--radius-xl)]',
          'border border-zinc-200 dark:border-zinc-800',
          'bg-white dark:bg-zinc-900',
          'px-3.5 py-2.5',
          'shadow-md shadow-zinc-200/50 dark:shadow-black/30',
          'transition-[border-color,box-shadow] duration-100 ease-out',
          'focus-within:border-zinc-400 dark:focus-within:border-zinc-600',
          'focus-within:ring-2 focus-within:ring-zinc-400/20',
          className
        )}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent',
            'py-1.5 text-[13.5px] leading-relaxed',
            'text-zinc-900 dark:text-zinc-100',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'font-sans-ui',
            'focus:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'select-text'
          )}
          style={{
            minHeight: MIN_HEIGHT - 22,
            maxHeight: MAX_HEIGHT,
          }}
        />

        {/* ── Trailing action: send / stop / loading ──────────────────────── */}
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            title="Stop generating"
            aria-label="Stop generating"
            className={cn(
              'h-8 w-8 rounded-[var(--radius-md)]',
              'flex items-center justify-center shrink-0',
              'bg-rose-600 hover:bg-rose-700 text-white',
              'transition-colors duration-100 ease-out',
              'shadow-xs cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40'
            )}
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        ) : isSending ? (
          <button
            type="button"
            disabled
            aria-label="Sending"
            className={cn(
              'h-8 w-8 rounded-[var(--radius-md)]',
              'flex items-center justify-center shrink-0',
              'bg-zinc-100 dark:bg-zinc-800',
              'text-zinc-500 dark:text-zinc-400',
              'cursor-not-allowed opacity-70'
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
            aria-label="Send message"
            className={cn(
              'h-8 w-8 rounded-[var(--radius-md)]',
              'flex items-center justify-center shrink-0',
              'transition-all duration-100 ease-out',
              canSend
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs active:scale-95'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
            )}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </form>
    );
  }
);