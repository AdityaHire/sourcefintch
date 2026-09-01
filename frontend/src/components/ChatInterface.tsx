import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './Sidebar';
import CodeViewer from './CodeViewer';
import MarkdownRenderer from './MarkdownRenderer';
import { ThinkingTool } from '@/components/ui/thinking-tool';
import { Banner } from './ui/Banner';
import { Skeleton } from './ui/Skeleton';
import { StatusDot } from './ui/StatusDot';
import { useApiClient } from '../services/useApiClient';
import type {
  Repository,
  ChatMessage,
  SourceCitation,
} from '../types';
import {
  Code,
  Plus,
  ArrowUp,
  FileCode,
  Sparkles,
  Menu,
  Bug,
  Layers,
  Code2,
  FileSearch,
} from 'lucide-react';

export default function ChatInterface() {
  const api = useApiClient();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll to bottom of message list ─────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting]);

  // ── Auto-resize composer textarea ─────────────────────────────────────────
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputQuery]);

  // ── 1. Initial Load: Repositories & URL-Driven Persistence ────────────────
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoadingRepos(true);
      try {
        const repos = await api.fetchCompletedRepositories();
        if (!isMounted) return;
        setRepositories(repos);

        // Check URL search params for existing conversation_id
        const params = new URLSearchParams(window.location.search);
        const convParam = params.get('conversationId');

        if (convParam && !isNaN(Number(convParam))) {
          const convId = Number(convParam);
          setConversationId(convId);
          setIsLoadingConv(true);
          try {
            const convData = await api.fetchConversation(convId);
            if (!isMounted) return;
            setMessages(convData.messages || []);
            setSelectedRepoId(convData.repository_id);

            // Auto-select first citation without forcing panel open
            const firstWithSources = convData.messages?.find(
              (m) => m.role === 'assistant' && m.sources && m.sources.length > 0
            );
            if (firstWithSources && firstWithSources.sources?.[0]) {
              setSelectedCitation(firstWithSources.sources[0]);
            }
          } catch (convErr: any) {
            if (!isMounted) return;
            setErrorMessage(`Failed to load conversation #${convId}: ${convErr.message}`);
            window.history.replaceState(null, '', window.location.pathname);
            setConversationId(null);
          } finally {
            if (isMounted) setIsLoadingConv(false);
          }
        } else if (repos.length > 0) {
          setSelectedRepoId(repos[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load repositories');
      } finally {
        if (isMounted) setIsLoadingRepos(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Switch repository ─────────────────────────────────────────────────────
  const handleRepoChange = (newRepoId: number) => {
    setSelectedRepoId(newRepoId);
    setConversationId(null);
    setMessages([]);
    setSelectedCitation(null);
    setIsCodeViewerOpen(false);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + url.search);
  };

  // ── New Chat in current repository ────────────────────────────────────────
  const handleNewChat = async () => {
    if (!selectedRepoId) return;

    setPersistenceWarning(false);
    setConversationId(null);
    setMessages([]);
    setSelectedCitation(null);
    setIsCodeViewerOpen(false);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + url.search);

    try {
      const newConv = await api.createConversation(selectedRepoId);
      setConversationId(newConv.id);
      const url = new URL(window.location.href);
      url.searchParams.set('conversationId', String(newConv.id));
      window.history.pushState(null, '', url.pathname + url.search);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create new conversation');
    }

    textareaRef.current?.focus();
  };

  const handleRepoAdded = (newRepo: Repository) => {
    setRepositories((prev) => [newRepo, ...prev.filter((r) => r.id !== newRepo.id)]);
    setSelectedRepoId(newRepo.id);
  };

  const handleRepoDeleted = (deletedRepoId: number) => {
    setRepositories((prev) => {
      const remaining = prev.filter((r) => r.id !== deletedRepoId);
      if (selectedRepoId === deletedRepoId) {
        if (remaining.length > 0) {
          handleRepoChange(remaining[0].id);
        } else {
          setSelectedRepoId(null);
          setConversationId(null);
          setMessages([]);
          setSelectedCitation(null);
          setIsCodeViewerOpen(false);
        }
      }
      return remaining;
    });
  };

  // ── Send chat message ─────────────────────────────────────────────────────
  const handleSendMessage = async (customPrompt?: string) => {
    const userText = (customPrompt || inputQuery).trim();
    if (!userText || !selectedRepoId || isSubmitting) return;

    setInputQuery('');
    setErrorMessage(null);

    const optimisticUserMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsSubmitting(true);

    try {
      const response = await api.sendChatMessage({
        conversation_id: conversationId || undefined,
        repository_id: selectedRepoId,
        message: userText,
        new_conversation: !conversationId,
      });

      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
        const url = new URL(window.location.href);
        url.searchParams.set('conversationId', String(response.conversation_id));
        window.history.pushState(null, '', url.pathname + url.search);
      }

      if (response.persistence_warning) {
        setPersistenceWarning(true);
      } else {
        setPersistenceWarning(false);
      }

      const assistantMsg: ChatMessage = {
        id: response.message.id,
        role: 'assistant',
        content: response.message.content,
        sources: response.message.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Cache latest citation for Show Code inspection
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
    setIsCodeViewerOpen(true);
  };

  // Direct code opener for markdown tokens
  const handleOpenCode = (filePath: string, startLine?: number, endLine?: number) => {
    // Check if matching citation exists in messages
    let foundCitation: SourceCitation | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const s = messages[i].sources?.find(
        (src) => src.file_path.includes(filePath) || filePath.includes(src.file_path)
      );
      if (s) {
        foundCitation = s;
        break;
      }
    }

    if (foundCitation) {
      setSelectedCitation(foundCitation);
    } else {
      setSelectedCitation({
        file_path: filePath,
        start_line: startLine || 1,
        end_line: endLine || startLine || 1,
        content: `// Source code snippet for ${filePath}:${startLine || 1}-${endLine || startLine || 1}`,
        score: 0.95,
      });
    }
    setIsCodeViewerOpen(true);
  };

  const activeRepo = useMemo(
    () => repositories.find((r) => r.id === selectedRepoId) || null,
    [repositories, selectedRepoId]
  );
  const hasTextToSend = inputQuery.trim().length > 0;

  // Suggested starter prompts
  const starterPrompts = [
    { label: 'Explain this project', icon: Sparkles, query: 'Explain the high-level architecture and purpose of this project.' },
    { label: 'Find bugs & edge cases', icon: Bug, query: 'Analyze the codebase and identify any bugs, missing error handling, or edge cases.' },
    { label: 'How does routing work?', icon: Layers, query: 'How is routing and request handling implemented across the codebase?' },
    { label: 'Find unused or dead code', icon: FileSearch, query: 'Look for any unused functions, redundant variables, or obsolete code blocks.' },
    { label: 'Explain data flow', icon: Code2, query: 'Explain the main data flow and state management throughout the repository.' },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent font-sans-ui text-zinc-900 dark:text-zinc-100 select-none">
      {/* ── 1. LEFT PANEL: Sidebar (Repositories) ─────────────────────────── */}
      <Sidebar
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onSelectRepo={handleRepoChange}
        isLoading={isLoadingRepos}
        onRepoAdded={handleRepoAdded}
        onRepoDeleted={handleRepoDeleted}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* ── 2. CENTER PANEL: Chat Workspace ───────────────────────────────── */}
      <div className="relative flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-white/20 dark:bg-transparent">
        {/* ── Top Repository Bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/50 px-4 sm:px-6 py-2.5 shrink-0 backdrop-blur-md z-10">
          {/* Left: Dominant repo name + branch & indexed status */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
              title="Open repositories"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 truncate">
              <span className="text-[14px] font-semibold text-zinc-900 dark:text-white font-sans-ui truncate">
                {activeRepo ? `${activeRepo.owner} / ${activeRepo.name}` : 'Select a Repository'}
              </span>

              {activeRepo && (
                <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 font-sans-ui">
                  <span className="rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 px-1.5 py-0.5 font-code text-[11px] text-zinc-600 dark:text-zinc-400">
                    {activeRepo.branch || 'main'}
                  </span>
                  <span>·</span>
                  <span>{activeRepo.file_count || 0} files</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-medium">
                    <StatusDot status="online" label="Indexed" className="text-[12px]" />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Show Code, Chat ID & Primary + New Chat Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Show Code toggle button */}
            <button
              type="button"
              onClick={() => {
                if (!isCodeViewerOpen && !selectedCitation) {
                  for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].sources && messages[i].sources!.length > 0) {
                      setSelectedCitation(messages[i].sources![0]);
                      break;
                    }
                  }
                }
                setIsCodeViewerOpen(!isCodeViewerOpen);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs font-sans-ui ${
                isCodeViewerOpen
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 ring-1 ring-zinc-700 dark:ring-zinc-300'
                  : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100'
              }`}
              title={isCodeViewerOpen ? 'Hide code viewer' : 'Show code viewer'}
            >
              <Code className="w-3.5 h-3.5" />
              <span>{isCodeViewerOpen ? 'Hide Code' : 'Show Code'}</span>
            </button>

            {/* Primary Action: + New Chat */}
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isSubmitting || (messages.length === 0 && !conversationId)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed font-sans-ui"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        <Banner show={!!errorMessage} tone="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Banner>

        {/* Persistence Warning Banner */}
        <Banner show={persistenceWarning} tone="warning" onDismiss={() => setPersistenceWarning(false)}>
          Response shown, but could not be saved to history due to a storage issue.
        </Banner>

        {/* ── Scrollable Conversation Stream ───────────────────────────────── */}
        <div className="relative z-1 flex-1 overflow-y-auto px-4 sm:px-8 py-5 select-text">
          {isLoadingConv ? (
            <div className="space-y-4 max-w-3xl mx-auto w-full px-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : messages.length === 0 ? (
            /* ── Empty State with Suggested Starters ───────────────────────── */
            <div className="flex h-full flex-col items-center justify-center max-w-xl mx-auto text-center px-4 my-auto select-none">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 mb-4 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2 font-sans-ui">
                {activeRepo ? `Explore ${activeRepo.name}` : 'Select a Repository'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed mb-8 font-sans-ui">
                Ask any architectural or bug investigation question. Answers are grounded in your indexed source code.
              </p>

              {/* Suggested Questions Grid */}
              <div className="w-full text-left space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1 font-sans-ui">
                  Try asking:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {starterPrompts.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.query)}
                        disabled={!selectedRepoId || isSubmitting}
                        className="flex items-center gap-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs font-sans-ui group disabled:opacity-50"
                      >
                        <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="font-medium truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ── Compact, High-Density Conversation Messages ─────────────── */
            <div className="max-w-3xl mx-auto w-full space-y-5">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex flex-col ${
                      index > 0 && !isUser ? 'pt-4 border-t border-zinc-100 dark:border-zinc-900/80' : ''
                    }`}
                  >
                    {/* Header: Identity & Timestamp */}
                    <div className={`flex items-center gap-2 text-[11.5px] mb-1.5 font-sans-ui ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className={`font-medium ${isUser ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5'}`}>
                        {!isUser && (
                          <span className="w-4 h-4 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[9px] font-code text-zinc-700 dark:text-zinc-300 font-bold">
                            SF
                          </span>
                        )}
                        {isUser ? 'You' : 'Sourcefinch'}
                      </span>
                      {msg.created_at && (
                        <span className="text-zinc-400 dark:text-zinc-600 font-code text-[10.5px]">
                          · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    {isUser ? (
                      /* User message: clean compact bubble aligned right */
                      <div className="flex justify-end">
                        <div className="max-w-[65ch] rounded-xl px-4 py-2 text-[13.5px] leading-relaxed bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-sans-ui shadow-2xs">
                          {msg.content}
                        </div>
                      </div>
                     ) : (
                      /* Assistant message: structured document format */
                      <div className="flex flex-col items-start w-full">
                        {msg.content ? (
                          <MarkdownRenderer content={msg.content} onOpenCode={handleOpenCode} />
                        ) : (
                          <div className="max-w-[72ch] rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-900 dark:text-amber-200 font-sans-ui">
                            No answer was generated for this question. The LLM returned an empty response — this can happen with very short queries or if the model truncated its output. Try rephrasing your question.
                          </div>
                        )}

                        {/* ── CITED SOURCES · Prominent Interactive Table ── */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900/80 w-full max-w-[72ch]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[11px] font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase font-sans-ui flex items-center gap-1.5">
                                <FileCode className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Cited Sources · {msg.sources.length}</span>
                              </div>
                              <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
                                Click row to inspect code
                              </span>
                            </div>

                            {/* Source Rows Table */}
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/60 shadow-2xs">
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
                                    onClick={() => handleCitationClick(source)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left font-code text-xs transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>
                                        📄
                                      </span>
                                      <span className="truncate font-semibold text-[12px]">{source.file_path}</span>
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
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* ── Minimal thinking indicator while generating ──────────── */}
              {isSubmitting && (
                <div className="flex items-center gap-1.5 text-[11.5px] font-sans-ui text-zinc-500 dark:text-zinc-400 pt-2">
                  <span className="w-4 h-4 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[9px] font-code text-zinc-700 dark:text-zinc-300 font-bold shrink-0">
                    SF
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mr-1">Sourcefinch</span>
                  <ThinkingTool isThinking={true} />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 3. Bottom Composer: Elevated, Anchored, Professional ─────────── */}
        <div className="relative z-10 border-t border-zinc-200/80 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/60 p-3 sm:p-4 shrink-0 backdrop-blur-md">
          <div className="max-w-3xl mx-auto w-full">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative font-sans-ui">
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 px-3.5 py-2.5 shadow-md shadow-zinc-200/50 dark:shadow-black/30 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-2 focus-within:ring-zinc-400/20 transition-all">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedRepoId
                      ? 'Ask anything about this repository...'
                      : 'Select a repository to start'
                  }
                  disabled={!selectedRepoId || isSubmitting}
                  className="flex-1 resize-none bg-transparent py-1 text-[13.5px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed max-h-36 leading-relaxed font-sans-ui select-text"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!hasTextToSend || !selectedRepoId || isSubmitting}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0 ${
                    hasTextToSend && selectedRepoId && !isSubmitting
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer shadow-xs scale-100'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
                  title={hasTextToSend ? 'Send message (Enter)' : 'Enter message'}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              {/* Subdued User Benefit Copy */}
              <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
                <span>Answers grounded in your source code</span>
                <span className="hidden sm:inline font-code text-[10px]">Return ↵ to send</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── 3. FULLSCREEN CODE INSPECTOR OVERLAY ──────────────────────────── */}
      <AnimatePresence>
        {isCodeViewerOpen && (
          <motion.div
            key="code-viewer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full z-30 flex flex-col bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md"
            style={{ transformOrigin: 'center' }}
          >
            <CodeViewer
              citation={selectedCitation}
              activeRepo={activeRepo}
              onClose={() => setIsCodeViewerOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
