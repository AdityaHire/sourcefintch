import { motion } from 'motion/react';
import { ArrowRight, Copy, Check, FileCode } from 'lucide-react';
import type { ChatMessage, SourceCitation } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ThinkingTool } from '@/components/ui/thinking-tool';
import { appleSprings, haptics } from '../lib/applePhysics';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isSubmitting: boolean;
  copiedMsgId: number | string | null;
  selectedCitation: SourceCitation | null;
  isCodeViewerOpen: boolean;
  suggestedQuestions: string[];
  selectedRepoId: number | null;
  onCopyMessage: (id: number | string, text: string) => void;
  onCitationClick: (citation: SourceCitation) => void;
  onOpenCode: (filePath: string, startLine?: number, endLine?: number) => void;
  onSendMessage: (prompt: string) => void;
  onClearSuggestions: () => void;
  onTypingComplete: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({
  messages,
  isSubmitting,
  copiedMsgId,
  selectedCitation,
  isCodeViewerOpen,
  suggestedQuestions,
  selectedRepoId,
  onCopyMessage,
  onCitationClick,
  onOpenCode,
  onSendMessage,
  onClearSuggestions,
  onTypingComplete,
  messagesEndRef,
}: ChatMessageListProps) {
  return (
    <div className="max-w-4xl xl:max-w-5xl mx-auto w-full space-y-6">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={appleSprings.default}
            className={`flex flex-col ${index > 0 && !isUser ? 'pt-2' : ''}`}
          >
            {/* Message Content */}
            {isUser ? (
              <>
                <div
                  className="flex items-center gap-2 text-[11.5px] mb-2 font-sans-ui justify-end"
                >
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">You</span>
                  {msg.created_at && (
                    <span className="text-zinc-400 dark:text-zinc-600 font-code text-[10.5px]">
                      ·{' '}
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[72ch] rounded-2xl px-4.5 py-2.5 text-[14px] leading-relaxed bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-sans-ui shadow-2xs">
                    {msg.content}
                  </div>
                </div>
              </>
            ) : (
              /* Assistant message: structured document with subtle background */
              <div className="flex w-full flex-col items-center">
                <div className="w-full max-w-[80ch] xl:max-w-[85ch]">
                  <div className="mb-2 flex items-center gap-2 text-[11.5px] font-sans-ui justify-start text-left">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <img
                        src="/logo2.png"
                        alt="Sourcefinch"
                        className="w-4 h-4 rounded-sm object-contain dark:hidden"
                      />
                      <img
                        src="/logo.png"
                        alt="Sourcefinch"
                        className="w-4 h-4 rounded-sm object-contain hidden dark:block"
                      />
                      Sourcefinch
                    </span>
                    {msg.created_at && (
                      <span className="text-zinc-400 dark:text-zinc-600 font-code text-[10.5px]">
                        ·{' '}
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <div className={`mx-auto w-full max-w-[80ch] xl:max-w-[85ch] rounded-2xl border border-zinc-200/85 border-l-2 border-l-indigo-500/80 dark:border-white/[0.08] dark:border-l-indigo-400 border-t-white/90 dark:border-t-white/15 bg-white/80 dark:bg-[#111215]/60 p-5 sm:p-6 shadow-sm backdrop-blur-md transition-all text-left ${!msg.content && isSubmitting && index === messages.length - 1 ? 'p-3 sm:p-4' : ''}`}>
                    {msg.content ? (
                    <>
                      <MarkdownRenderer
                        content={msg.content}
                        onOpenCode={onOpenCode}
                        animate={false}
                        onTypingComplete={onTypingComplete}
                        isStreaming={isSubmitting && index === messages.length - 1}
                      />
                      {/* Message Actions Toolbar (Copy response button) */}
                      <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 mt-4 pt-3 text-zinc-400">
                        <button
                          type="button"
                          onClick={() => {
                            haptics.trigger('success');
                            onCopyMessage(msg.id || index, msg.content);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-100 cursor-pointer shadow-2xs border active:scale-95 ${
                            copiedMsgId === (msg.id || index)
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/70'
                              : 'bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-zinc-200/90 dark:border-zinc-700/80 border-t-white/80 dark:border-t-white/10'
                          }`}
                          title="Copy response to clipboard"
                        >
                          {copiedMsgId === (msg.id || index) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied response</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Copy response</span>
                            </>
                          )}
                        </button>

                        {msg.sources && msg.sources.length > 0 && (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
                            {msg.sources.length} source{msg.sources.length === 1 ? '' : 's'} cited
                          </span>
                        )}
                      </div>
                    </>
                    ) : isSubmitting && index === messages.length - 1 ? (
                      <div className="px-1 py-2">
                        <ThinkingTool isThinking={true} />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-900 dark:text-amber-200 font-sans-ui">
                        No answer was generated for this question. The LLM returned an empty response — this can happen with very short queries or if the model truncated its output. Try rephrasing your question.
                      </div>
                    )}
                  </div>
                </div>

                {/* ── CITED SOURCES · Prominent Interactive Table ── */}
                {msg.sources && msg.sources.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-3 w-full max-w-[80ch] xl:max-w-[85ch]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase font-sans-ui flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span>Cited Sources · {msg.sources.length}</span>
                      </div>
                      <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
                        Click row to inspect code
                      </span>
                    </div>

                    <div className="rounded-[7px] border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/45 overflow-hidden shadow-2xs">
                      {msg.sources.map((source: SourceCitation, sIdx: number) => {
                        const isSelected =
                          isCodeViewerOpen &&
                          selectedCitation?.file_path === source.file_path &&
                          selectedCitation?.start_line === source.start_line &&
                          selectedCitation?.end_line === source.end_line;
                        const scorePct = Math.round((source.score || 0) * 100);

                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => {
                              haptics.trigger('selection');
                              onCitationClick(source);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 text-left font-code text-xs transition-colors cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500/50 ${
                              isSelected
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileCode
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isSelected
                                    ? 'text-zinc-700 dark:text-zinc-200'
                                    : 'text-zinc-400'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="truncate font-semibold text-[12px]">
                                {source.file_path}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span>
                                {source.start_line === source.end_line
                                  ? `Line ${source.start_line}`
                                  : `Lines ${source.start_line}–${source.end_line}`}
                              </span>
                              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                                {scorePct}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* ── Suggested Follow-up Questions ──────────────────────────── */}
      {suggestedQuestions.length > 0 && !isSubmitting && messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full pt-4 pb-1 max-w-[80ch] xl:max-w-[85ch]"
        >
          <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
            <img src="/logo2.png" alt="Sourcefinch" className="h-3.5 w-3.5 rounded-sm object-contain dark:hidden" />
            <img src="/logo.png" alt="Sourcefinch" className="hidden h-3.5 w-3.5 rounded-sm object-contain dark:block" />
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-sans-ui">
              Suggested Follow-ups
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {suggestedQuestions.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => {
                  haptics.trigger('medium');
                  onClearSuggestions();
                  onSendMessage(q);
                }}
                disabled={!selectedRepoId || isSubmitting}
                className="group flex items-center gap-3 rounded-xl border border-zinc-200/85 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.025] px-4 py-2.5 text-left text-[13px] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400/60 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all cursor-pointer font-sans-ui disabled:opacity-50 shadow-2xs active:scale-[0.98]"
              >
                <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
                  <ArrowRight className="w-3 h-3 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
                <span className="font-medium leading-snug">{q}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatMessageList;
