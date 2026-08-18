import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import CodeViewer from './CodeViewer';
import {
  fetchCompletedRepositories,
  fetchConversation,
  sendChatMessage,
} from '../services/api';
import type {
  Repository,
  ChatMessage,
  SourceCitation,
} from '../types';

export default function ChatInterface() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileCodeOpen, setIsMobileCodeOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll to bottom of message list ─────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting]);

  // ── 1. Initial Load: Repositories & URL-Driven Persistence ────────────────
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoadingRepos(true);
      try {
        const repos = await fetchCompletedRepositories();
        if (!isMounted) return;
        setRepositories(repos);

        // Check URL search params for existing conversation_id (URL-driven ONLY)
        const params = new URLSearchParams(window.location.search);
        const convParam = params.get('conversationId');

        if (convParam && !isNaN(Number(convParam))) {
          const convId = Number(convParam);
          setConversationId(convId);
          setIsLoadingConv(true);
          try {
            const convData = await fetchConversation(convId);
            if (!isMounted) return;
            setMessages(convData.messages || []);
            setSelectedRepoId(convData.repository_id);

            // Auto-select the first citation in history if present
            const firstWithSources = convData.messages?.find(
              (m) => m.role === 'assistant' && m.sources && m.sources.length > 0
            );
            if (firstWithSources && firstWithSources.sources?.[0]) {
              setSelectedCitation(firstWithSources.sources[0]);
            }
          } catch (convErr: any) {
            if (!isMounted) return;
            setErrorMessage(`Failed to load conversation #${convId}: ${convErr.message}`);
            // Clear invalid param
            window.history.replaceState(null, '', window.location.pathname);
            setConversationId(null);
          } finally {
            if (isMounted) setIsLoadingConv(false);
          }
        } else if (repos.length > 0) {
          // Default to the first completed repository
          setSelectedRepoId(repos[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load completed repositories');
      } finally {
        if (isMounted) setIsLoadingRepos(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── 2. Handle "New Chat" ──────────────────────────────────────────────────
  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setErrorMessage(null);
    setSelectedCitation(null);
    setInputQuery('');

    // Remove ?conversationId from URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + (url.search || ''));
  };

  // ── 3. Handle Repository Change ───────────────────────────────────────────
  const handleRepoChange = (newRepoId: number) => {
    setSelectedRepoId(newRepoId);
    handleNewChat();
  };

  // ── 4. Handle Repository Added from Sidebar ───────────────────────────────
  const handleRepoAdded = (newRepo: Repository) => {
    setRepositories((prev) => {
      const exists = prev.some((r) => r.id === newRepo.id);
      if (exists) return prev.map((r) => (r.id === newRepo.id ? newRepo : r));
      return [newRepo, ...prev];
    });
  };

  // ── 5. Send Message ───────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || !selectedRepoId || isSubmitting) return;

    const userText = inputQuery.trim();
    setInputQuery('');
    setErrorMessage(null);

    // Optimistically append user message to UI
    const optimisticUserMsg: ChatMessage = {
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsSubmitting(true);

    try {
      const response = await sendChatMessage({
        conversation_id: conversationId || undefined,
        repository_id: selectedRepoId,
        message: userText,
      });

      // Update active conversation ID and URL if newly created
      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
        const url = new URL(window.location.href);
        url.searchParams.set('conversationId', String(response.conversation_id));
        window.history.pushState(null, '', url.pathname + url.search);
      }

      // Append assistant message
      const assistantMsg: ChatMessage = {
        id: response.message.id,
        role: 'assistant',
        content: response.message.content,
        sources: response.message.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // If citations returned, auto-focus first citation in CodeViewer
      if (response.message.sources && response.message.sources.length > 0) {
        setSelectedCitation(response.message.sources[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while answering your question.');
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCitationClick = (citation: SourceCitation) => {
    setSelectedCitation(citation);
    setIsMobileCodeOpen(true);
  };

  const activeRepo = repositories.find((r) => r.id === selectedRepoId) || null;

  return (
    <div className="flex h-[calc(100vh-3.75rem)] w-full overflow-hidden bg-zinc-950">
      {/* ── 1. LEFT PANEL: Sidebar (Repositories) ─────────────────────────── */}
      <Sidebar
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onSelectRepo={handleRepoChange}
        isLoading={isLoadingRepos}
        onRepoAdded={handleRepoAdded}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* ── 2. CENTER PANEL: Chat Workspace ───────────────────────────────── */}
      <div className="flex flex-1 flex-col h-full min-w-0 bg-zinc-950/60 overflow-hidden">
        {/* Top Chat Subheader */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-zinc-900/40 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-white cursor-pointer"
              title="Open repositories sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">
                  {activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : 'Select a Repository'}
                </span>
                {activeRepo && (
                  <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 text-[10px] font-mono text-indigo-300">
                    {activeRepo.branch || 'main'}
                  </span>
                )}
              </div>
              {activeRepo && (
                <div className="text-[11px] text-zinc-500 font-mono truncate">
                  {activeRepo.file_count} indexed files · Qdrant ready
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile code viewer toggle */}
            {selectedCitation && (
              <button
                type="button"
                onClick={() => setIsMobileCodeOpen(!isMobileCodeOpen)}
                className="xl:hidden flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Code</span>
              </button>
            )}

            {conversationId && (
              <span className="hidden sm:inline-block rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 text-[11px] text-zinc-400 font-mono">
                Thread #{conversationId}
              </span>
            )}

            <button
              type="button"
              onClick={handleNewChat}
              disabled={isSubmitting || (messages.length === 0 && !conversationId)}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:bg-white/[0.1] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-xs text-red-300 shrink-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 cursor-pointer font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoadingConv ? (
            <div className="flex h-full items-center justify-center text-zinc-500 gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <span className="text-sm">Re-hydrating conversation from database...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 py-12">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-200 mb-1">
                Chat with {activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : 'Codebase'}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Ask anything about functions, APIs, architecture, or configuration. Citations open directly in the Code Viewer panel on the right.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 px-1 font-mono">
                    <span>{isUser ? 'You' : 'Sourcefinch AI'}</span>
                    {msg.created_at && (
                      <span>· {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>

                  <div
                    className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-50 rounded-tr-sm'
                        : 'bg-white/[0.04] border border-white/[0.08] text-zinc-200 rounded-tl-sm'
                    }`}
                  >
                    {/* Message Content */}
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Multi-turn isolated retrieval guidance tip on fallback */}
                    {!isUser && msg.content.includes("couldn't find enough evidence") && index > 1 && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200/90 font-sans">
                        <span className="text-amber-400 font-bold shrink-0">💡 Tip:</span>
                        <span>
                          Questions are currently evaluated independently. Try including the repository or file name explicitly (e.g. <em>&quot;How do I run {activeRepo?.name || 'this repo'}?&quot;</em>).
                        </span>
                      </div>
                    )}

                    {/* Assistant Source Citations */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-white/[0.08]">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                          <svg className="h-3 w-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Citations ({msg.sources.length}):
                        </div>

                        {/* Citation Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((source: SourceCitation, sIdx: number) => {
                            const isSelected =
                              selectedCitation?.file_path === source.file_path &&
                              selectedCitation?.start_line === source.start_line &&
                              selectedCitation?.end_line === source.end_line;
                            const scorePct = Math.round((source.score || 0) * 100);

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleCitationClick(source)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-violet-500 bg-violet-500/25 text-violet-100 shadow-sm shadow-violet-500/20'
                                    : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-violet-400/40 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                              >
                                <span className="text-zinc-200 font-medium">
                                  {source.file_path}:{source.start_line}-{source.end_line}
                                </span>
                                <span className="rounded bg-black/40 px-1 py-0.2 text-[10px] text-zinc-400">
                                  {scorePct}%
                                </span>
                                <span className="text-[10px] text-violet-300">
                                  {isSelected ? '▶' : '→'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Loading state bubble */}
          {isSubmitting && (
            <div className="flex flex-col items-start space-y-1.5">
              <div className="text-[11px] text-zinc-500 px-1 font-mono">Sourcefinch AI</div>
              <div className="rounded-2xl rounded-tl-sm border border-violet-500/30 bg-violet-950/20 px-4 py-3 text-sm text-violet-300 flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce" />
                </div>
                <span>Searching Qdrant vectors & generating answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer */}
        <div className="border-t border-white/[0.08] bg-zinc-900/40 p-3 sm:p-4 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedRepoId
                  ? 'Ask a question about this repository... (Enter to send, Shift+Enter for newline)'
                  : 'Please select a repository from the left sidebar to start chatting'
              }
              disabled={!selectedRepoId || isSubmitting}
              className="flex-1 resize-none rounded-xl border border-white/[0.1] bg-zinc-900/90 px-4 py-2.5 text-sm text-white placeholder-zinc-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || !selectedRepoId || isSubmitting}
              className="h-10 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-medium text-xs sm:text-sm text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <span>Send</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* ── 3. RIGHT PANEL: Code Viewer ───────────────────────────────────── */}
      <div
        className={`shrink-0 transition-all duration-300 z-10 ${
          isMobileCodeOpen
            ? 'fixed inset-y-0 right-0 w-full sm:w-[480px] shadow-2xl block'
            : 'hidden xl:flex xl:w-[420px] 2xl:w-[480px]'
        }`}
      >
        <CodeViewer
          citation={selectedCitation}
          activeRepo={activeRepo}
          onClose={() => setIsMobileCodeOpen(false)}
        />
      </div>
    </div>
  );
}
