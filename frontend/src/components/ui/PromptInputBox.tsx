/**
 * PromptInputBox — Replit-inspired floating chat composer.
 *
 * Features:
 *   - Clean floating rounded-2xl card with ambient blur and subtle shadow.
 *   - Auto-resizing multi-line textarea.
 *   - Enter sends; Shift+Enter inserts a newline.
 *   - Bottom toolbar row inside card with + button, status badge, and send button.
 *   - Dual light & dark mode support.
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
import { ArrowUp, Square, Loader2, Plus, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const MAX_HEIGHT = 160; // px
const MIN_HEIGHT = 38; // px

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
  /** Set the textarea value programmatically and focus it. */
  setText: (text: string) => void;
}

export const PromptInputBox = forwardRef<PromptInputBoxHandle, PromptInputBoxProps>(
  function PromptInputBox(
    {
      placeholder = 'Start chatting or describe a task...',
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
      el.style.height = `${Math.max(next, MIN_HEIGHT)}px`;
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
          requestAnimationFrame(adjustHeight);
        },
        setText: (text: string) => {
          setValue(text);
          requestAnimationFrame(() => {
            adjustHeight();
            taRef.current?.focus();
          });
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

    const isStreaming = status === 'streaming';
    const isSending = status === 'sending';

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className={cn(
          'relative flex flex-col',
          'rounded-2xl',
          'border border-zinc-200/90 dark:border-white/[0.09]',
          'bg-white/90 dark:bg-zinc-900/85',
          'shadow-xl shadow-zinc-200/40 dark:shadow-black/50',
          'backdrop-blur-xl',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus-within:border-zinc-400 dark:focus-within:border-zinc-600',
          'focus-within:ring-2 focus-within:ring-zinc-400/15 dark:focus-within:ring-white/10',
          'p-3',
          className
        )}
      >
        {/* ── Top text area ────────────────────────────────────────────────── */}
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
            'w-full resize-none bg-transparent',
            'px-1 py-1 text-[13.5px] leading-relaxed',
            'text-zinc-900 dark:text-zinc-100',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'font-sans-ui',
            'focus:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'select-text'
          )}
          style={{
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
          }}
        />

        {/* ── Bottom toolbar row inside composer ───────────────────────────── */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100/80 dark:border-white/[0.04]">
          {/* Left: action button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              title="Add context"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Right: badge & send button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/50 dark:border-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 font-sans-ui select-none">
              <Sparkles className="w-3 h-3 text-orange-500 dark:text-orange-400" />
              <span>RAG</span>
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                title="Stop generating"
                aria-label="Stop generating"
                className="h-7 w-7 rounded-lg flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white transition-colors duration-100 shadow-xs cursor-pointer"
              >
                <Square className="h-3 w-3" fill="currentColor" />
              </button>
            ) : isSending ? (
              <button
                type="button"
                disabled
                aria-label="Sending"
                className="h-7 w-7 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed opacity-70"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
                aria-label="Send message"
                className={cn(
                  'h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-100',
                  canSend
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs active:scale-95'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </form>
    );
  }
);
export default PromptInputBox;