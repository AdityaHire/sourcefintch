/**
 * PromptInputBox — Apple Design floating translucent composer.
 *
 * Features:
 *   - Translucent glassmorphism with specular light edge (backdrop-blur-2xl, saturate-180).
 *   - Auto-resizing multi-line textarea with 1:1 instantaneous response.
 *   - Enter sends; Shift+Enter inserts a newline.
 *   - Instant press feedback and tactile haptics on send/stop.
 *   - Optical sizing & refined typography.
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
import { ArrowUp, Square, Loader2, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { haptics } from '../../lib/applePhysics';

const MAX_HEIGHT = 160; // px
const MIN_HEIGHT = 24; // px

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
      haptics.trigger('medium');
      onSend(trimmed);
      setValue('');
      requestAnimationFrame(adjustHeight);
    }, [canSend, onSend, trimmed, adjustHeight]);

    const handleStop = useCallback(() => {
      haptics.trigger('light');
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
          'prompt-composer relative flex items-end gap-2.5',
          'rounded-2xl',
          'border border-zinc-200/80 dark:border-white/[0.08]',
          'border-t-white/95 dark:border-t-white/20',
          'bg-white/85 dark:bg-[#111215]/85',
          'shadow-xl shadow-black/[0.06] dark:shadow-black/40',
          'backdrop-blur-2xl backdrop-saturate-180',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus-within:border-zinc-400/80 dark:focus-within:border-white/30',
          'focus-within:ring-2 focus-within:ring-zinc-400/20 dark:focus-within:ring-white/10',
          'px-3.5 py-2.5 sm:px-4 sm:py-3',
          className
        )}
      >
        {/* Left context button */}
        <button
          type="button"
          disabled={disabled}
          title="Add context"
          onClick={() => haptics.trigger('light')}
          className="w-8 h-8 rounded-lg border border-transparent flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 mb-0.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Textarea */}
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
            'py-1 text-[14px] leading-relaxed',
            'text-zinc-900 dark:text-zinc-100',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'font-sans-ui',
            'border-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'select-text'
          )}
          style={{
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
          }}
        />

        {/* Right action group: Send button */}
        <div className="flex items-center gap-2 shrink-0 mb-0.5">
          {value.length > 0 && (
            <span className="hidden sm:inline text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500 font-code tracking-wider" aria-live="polite">
              {value.length}
            </span>
          )}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              title="Stop generating"
              aria-label="Stop generating"
              className="h-8 w-8 rounded-xl border border-transparent border-t-white/30 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition-all duration-100 shadow-sm cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : isSending ? (
            <button
              type="button"
              disabled
              aria-label="Sending"
              className="h-8 w-8 rounded-xl border border-transparent flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed opacity-70"
            >
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600 dark:text-zinc-300" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
              aria-label="Send message"
              className={cn(
                'h-8 w-8 rounded-xl border border-transparent flex items-center justify-center transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50',
                canSend
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer shadow-xs active:scale-90 border-t-white/30 dark:border-t-white/60'
                  : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-40'
              )}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
          )}
        </div>
      </form>
    );
  }
);
export default PromptInputBox;