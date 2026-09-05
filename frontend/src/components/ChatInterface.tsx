import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUser } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import CodeViewer from './CodeViewer';
import MarkdownRenderer from './MarkdownRenderer';
import { ThinkingTool } from '@/components/ui/thinking-tool';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
  FileCode,
  Sparkles,
  Menu,
  Bug,
  Layers,
  Code2,
  FileSearch,
  FolderGit2,
  Clock,
  FolderTree,
  History,
} from 'lucide-react';
import { ConversationHistoryDrawer } from './ConversationHistoryDrawer';
import type { Conversation } from '../types';
import {
  PromptInputBox,
  type PromptInputBoxHandle,
} from './ui/PromptInputBox';
import FileTree from './ui/file-tree';
import type { RepositoryFile } from '../types';
import type { SidebarTab } from './Sidebar';

export interface ChatInterfaceProps {
  /** Which workspace tab is active — drives Sidebar nav highlight. */
  activeTab?: SidebarTab;
  onNavigateTo?: (tab: SidebarTab) => void;
  onOpenDocs?: () => void;
  theme?: 'light' | 'dark';
  setTheme?: (next: 'light' | 'dark') => void;
}

export default function ChatInterface(props: ChatInterfaceProps = {}) {
  const {
    activeTab = 'workspace',
    onNavigateTo = () => {},
    onOpenDocs = () => {},
    theme = 'light',
    setTheme = () => {},
  } = props;

  const api = useApiClient();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);
  const [repoFiles, setRepoFiles] = useState<RepositoryFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<PromptInputBoxHandle>(null);

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

  // ── Fetch Repository File Tree ───────────────────────────────────────────
  const fetchRepoFiles = useCallback(async (repoId: number) => {
    setIsLoadingFiles(true);
    try {
      const files = await api.getRepositoryFiles(repoId);
      setRepoFiles(files);
      if (files.length > 0) {
        setSelectedFile((prev) => (prev && files.some((f) => f.id === prev.id) ? prev : files[0]));
      }
    } catch (err: any) {
      console.error('Failed to load repo files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [api]);

  const handleToggleFileTree = () => {
    if (!isFileTreeOpen && selectedRepoId) {
      fetchRepoFiles(selectedRepoId);
    }
    setIsFileTreeOpen(!isFileTreeOpen);
    if (isCodeViewerOpen) setIsCodeViewerOpen(false);
  };

  // ── Switch repository ─────────────────────────────────────────────────────
  const handleRepoChange = (newRepoId: number) => {
    setSelectedRepoId(newRepoId);
    setConversationId(null);
    setMessages([]);
    setSelectedCitation(null);
    setIsCodeViewerOpen(false);
    setIsFileTreeOpen(false);
    setRepoFiles([]);
    setSelectedFile(null);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + url.search);
  };

  // ── New Chat in current repository ────────────────────────────────────────
  const handleNewChat = () => {
    setPersistenceWarning(false);
    setConversationId(null);
    setMessages([]);
    setSelectedCitation(null);
    setIsCodeViewerOpen(false);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + url.search);

    composerRef.current?.focus();
  };

  // ── Conversation History Loader & Handlers ───────────────────────────────
  const loadConversations = useCallback(
    async (repoId: number) => {
      setIsLoadingHistory(true);
      try {
        const list = await api.fetchConversations(repoId);
        setConversations(list);
      } catch (err: any) {
        console.error('Failed to load conversations:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [api]
  );

  useEffect(() => {
    if (selectedRepoId) {
      loadConversations(selectedRepoId);
    } else {
      setConversations([]);
    }
  }, [selectedRepoId, loadConversations]);

  const handleSelectConversation = async (convId: number) => {
    if (convId === conversationId) {
      setIsHistoryOpen(false);
      return;
    }
    setConversationId(convId);
    setIsLoadingConv(true);
    setErrorMessage(null);
    setSelectedCitation(null);
    setIsCodeViewerOpen(false);
    setIsHistoryOpen(false);

    const url = new URL(window.location.href);
    url.searchParams.set('conversationId', String(convId));
    window.history.pushState(null, '', url.pathname + url.search);

    try {
      const convData = await api.fetchConversation(convId);
      setMessages(convData.messages || []);
      const firstWithSources = convData.messages?.find(
        (m) => m.role === 'assistant' && m.sources && m.sources.length > 0
      );
      if (firstWithSources && firstWithSources.sources?.[0]) {
        setSelectedCitation(firstWithSources.sources[0]);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to load conversation #${convId}: ${err.message}`);
    } finally {
      setIsLoadingConv(false);
    }
  };

  const handleRenameConversation = async (convId: number, newTitle: string) => {
    try {
      const updated = await api.updateConversation(convId, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c))
      );
    } catch (err: any) {
      setErrorMessage(`Failed to rename conversation: ${err.message}`);
    }
  };

  const handleDeleteConversation = async (convId: number) => {
    try {
      await api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (conversationId === convId) {
        handleNewChat();
      }
    } catch (err: any) {
      setErrorMessage(`Failed to delete conversation: ${err.message}`);
    }
  };

  const handleClearAllConversations = async () => {
    if (!selectedRepoId) return;
    try {
      await api.deleteAllConversations(selectedRepoId);
      setConversations([]);
      handleNewChat();
    } catch (err: any) {
      setErrorMessage(`Failed to clear conversations: ${err.message}`);
    }
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
  const handleSendMessage = async (textFromComposer?: string) => {
    // The PromptInputBox already trims and gates on disabled/sending,
    // so any non-empty string we get is safe to send.
    const userText = (textFromComposer ?? '').trim();
    if (!userText || !selectedRepoId || isSubmitting) return;

    setErrorMessage(null);

    const optimisticUserMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    const assistantMsgId = Date.now() + 1;
    const optimisticAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg, optimisticAssistantMsg]);
    setIsSubmitting(true);

    try {
      await api.streamChatMessage(
        {
          conversation_id: conversationId || undefined,
          repository_id: selectedRepoId,
          message: userText,
          new_conversation: !conversationId,
        },
        {
          onConversation: (convId) => {
            if (!conversationId) {
              setConversationId(convId);
              const url = new URL(window.location.href);
              url.searchParams.set('conversationId', String(convId));
              window.history.pushState(null, '', url.pathname + url.search);
              if (selectedRepoId) {
                loadConversations(selectedRepoId);
              }
            }
          },
          onCitations: (sources) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, sources } : msg
              )
            );
            if (sources && sources.length > 0) {
              setSelectedCitation(sources[0]);
            }
          },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: (msg.content || '') + token }
                  : msg
              )
            );
          },
          onSaved: (savedId) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, id: savedId } : msg
              )
            );
            if (selectedRepoId) {
              loadConversations(selectedRepoId);
            }
          },
          onError: (err) => {
            setErrorMessage(err);
          },
        }
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while answering your question.');
      setMessages((prev) =>
        prev.filter(
          (msg) =>
            msg.id !== assistantMsgId ||
            (Boolean(msg.content) && msg.content.trim().length > 0)
        )
      );
    } finally {
      setIsSubmitting(false);
      composerRef.current?.focus();
    }
  };

  const handleCitationClick = (citation: SourceCitation) => {
    setSelectedCitation(citation);
    setIsCodeViewerOpen(true);
  };

  // Direct code opener for markdown tokens and interactive citations
  const handleOpenCode = (filePath: string, startLine?: number, endLine?: number) => {
    const sLine = startLine || 1;
    const eLine = endLine || sLine;

    // 1. Check if matching citation exists in recent message sources
    let foundCitation: SourceCitation | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const s = messages[i].sources?.find(
        (src) => src.file_path.endsWith(filePath) || filePath.endsWith(src.file_path)
      );
      if (s) {
        foundCitation = s;
        break;
      }
    }

    if (foundCitation) {
      setSelectedCitation(foundCitation);
    } else {
      // 2. Check if file is loaded in repoFiles to display real code lines
      const cleanPath = filePath.replace(/^\/+/, '');
      const matchFile = repoFiles.find(
        (f) => f.file_path === cleanPath || f.file_path.endsWith(cleanPath) || cleanPath.endsWith(f.file_path)
      );

      let content = `// Source code snippet for ${filePath}:${sLine}-${eLine}`;
      if (matchFile?.content) {
        const fileLines = matchFile.content.split('\n');
        const startIdx = Math.max(0, sLine - 1);
        const endIdx = Math.min(fileLines.length, eLine);
        content = fileLines.slice(startIdx, endIdx).join('\n') || matchFile.content;
      }

      setSelectedCitation({
        file_path: matchFile ? matchFile.file_path : filePath,
        start_line: sLine,
        end_line: eLine,
        content: content,
        score: 1.0,
      });
    }
    setIsCodeViewerOpen(true);
  };

  const activeRepo = useMemo(
    () => repositories.find((r) => r.id === selectedRepoId) || null,
    [repositories, selectedRepoId]
  );

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
        activeTab={activeTab}
        onNavigateTo={onNavigateTo}
        onOpenDocs={onOpenDocs}
      />

      {/* ── 2. CENTER PANEL: Chat Workspace ───────────────────────────────── */}
      <div className="relative flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-transparent">
        {/* ── Top Repository Bar (minimal/transparent) ────────────────────── */}
        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/[0.04] bg-white/50 dark:bg-zinc-950/30 backdrop-blur-xl px-4 sm:px-6 py-2.5 shrink-0 z-10">
          {/* Left: Dominant repo name + branch & indexed status */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
              title="Open repositories"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 truncate">
              <span className="text-[14px] font-semibold text-zinc-900 dark:text-white font-sans-ui truncate">
                {activeRepo ? `${activeRepo.owner} / ${activeRepo.name}` : 'Select a Repository'}
              </span>

              {activeRepo && (
                <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-500 font-sans-ui">
                  <span className="rounded-md bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/80 dark:border-white/[0.08] px-1.5 py-0.5 font-code text-[11px] text-zinc-600 dark:text-zinc-400">
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

          {/* Right: Files, Show Code & Primary + New Chat Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Files (Folder Structure) toggle button */}
            <button
              type="button"
              onClick={handleToggleFileTree}
              disabled={!selectedRepoId}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs font-sans-ui disabled:opacity-40 disabled:cursor-not-allowed ${
                isFileTreeOpen
                  ? 'bg-zinc-900 dark:bg-white/15 text-white ring-1 ring-zinc-700 dark:ring-white/10 hover:bg-zinc-800 dark:hover:bg-white/20'
                  : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title={isFileTreeOpen ? 'Hide folder structure' : 'Show folder structure'}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>{isFileTreeOpen ? 'Hide Files' : 'Files'}</span>
            </button>

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
                if (isFileTreeOpen) setIsFileTreeOpen(false);
                setIsCodeViewerOpen(!isCodeViewerOpen);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs font-sans-ui ${
                isCodeViewerOpen
                  ? 'bg-zinc-900 dark:bg-white/15 text-white ring-1 ring-zinc-700 dark:ring-white/10 hover:bg-zinc-800 dark:hover:bg-white/20'
                  : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title={isCodeViewerOpen ? 'Hide code viewer' : 'Show code viewer'}
            >
              <Code className="w-3.5 h-3.5" />
              <span>{isCodeViewerOpen ? 'Hide Code' : 'Show Code'}</span>
            </button>

            {/* History toggle button */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              disabled={!selectedRepoId}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs font-sans-ui disabled:opacity-40 disabled:cursor-not-allowed ${
                isHistoryOpen
                  ? 'bg-zinc-900 dark:bg-white/15 text-white ring-1 ring-zinc-700 dark:ring-white/10 hover:bg-zinc-800 dark:hover:bg-white/20'
                  : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="View past conversations"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {conversations.length > 0 && (
                <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] px-1.5 py-0.2 font-code">
                  {conversations.length}
                </span>
              )}
            </button>

            {/* Primary Action: + New Chat */}
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isSubmitting || (messages.length === 0 && !conversationId)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:from-orange-600 hover:to-amber-700 transition-all cursor-pointer shadow-sm shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed font-sans-ui"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            {/* Theme toggle — sits beside the New Chat action */}
            <ThemeToggle
              isDark={theme === 'dark'}
              onToggle={(isDark) => setTheme(isDark ? 'dark' : 'light')}
            />
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
            /* ── Replit-Inspired Empty State ────────────────────────────────── */
            <ReplitEmptyState
              repositories={repositories}
              activeRepo={activeRepo}
              selectedRepoId={selectedRepoId}
              isSubmitting={isSubmitting}
              starterPrompts={starterPrompts}
              onSendMessage={handleSendMessage}
              onSelectRepo={handleRepoChange}
            />
          ) : (
            /* ── Compact, High-Density Conversation Messages ─────────────── */
            <div className="max-w-3xl mx-auto w-full space-y-5">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex flex-col ${
                      index > 0 && !isUser ? 'pt-4' : ''
                    }`}
                  >
                    {/* Header: Identity & Timestamp */}
                    <div className={`flex items-center gap-2 text-[11.5px] mb-1.5 font-sans-ui ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className={`font-medium ${isUser ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5'}`}>
                        {!isUser && (
                          <>
                            <img src="/logo2.png" alt="Sourcefinch" className="w-4 h-4 rounded-sm object-contain dark:hidden" />
                            <img src="/logo.png" alt="Sourcefinch" className="w-4 h-4 rounded-sm object-contain hidden dark:block" />
                          </>
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
                          <MarkdownRenderer
                            content={msg.content}
                            onOpenCode={handleOpenCode}
                            animate={false}
                            onTypingComplete={scrollToBottom}
                          />
                        ) : isSubmitting && index === messages.length - 1 ? (
                          <div className="flex items-center gap-2.5 py-2 px-1 text-xs text-zinc-500 dark:text-zinc-400 font-sans-ui">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Searching codebase & reasoning...</span>
                          </div>
                        ) : (
                          <div className="max-w-[72ch] rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-900 dark:text-amber-200 font-sans-ui">
                            No answer was generated for this question. The LLM returned an empty response — this can happen with very short queries or if the model truncated its output. Try rephrasing your question.
                          </div>
                        )}

                        {/* ── CITED SOURCES · Prominent Interactive Table ── */}
                        {msg.sources && msg.sources.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                            className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900/80 w-full max-w-[72ch]"
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

                            {/* Source Rows — no row dividers; hover background distinguishes rows. */}
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-2xs">
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
                          </motion.div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* ── Minimal thinking indicator while generating ──────────── */}
              {isSubmitting && (
                <div className="flex items-center gap-1.5 text-[11.5px] font-sans-ui text-zinc-500 dark:text-zinc-400 pt-2">
                  <img src="/logo2.png" alt="Sourcefinch" className="w-4 h-4 rounded-sm object-contain shrink-0 dark:hidden" />
                  <img src="/logo.png" alt="Sourcefinch" className="w-4 h-4 rounded-sm object-contain shrink-0 hidden dark:block" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mr-1">Sourcefinch</span>
                  <ThinkingTool isThinking={true} />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 3. Bottom Composer: Floating PromptInputBox ───────────────────── */}
        <div className="relative z-10 px-4 pb-5 pt-1 shrink-0 bg-transparent">
          <div className="max-w-2xl mx-auto w-full">
            <PromptInputBox
              ref={composerRef}
              placeholder={
                selectedRepoId
                  ? 'Start chatting or describe a task...'
                  : 'Select a repository to start'
              }
              disabled={!selectedRepoId || isSubmitting}
              status={isSubmitting ? 'sending' : 'idle'}
              onSend={handleSendMessage}
            />

            {/* Subdued User Benefit Copy */}
            <div className="mt-2 px-1 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
              <span>Answers grounded in your source code</span>
              <span className="hidden sm:inline font-code text-[10px]">Return ↵ to send</span>
            </div>
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

      {/* ── 4. FULLSCREEN REPO FILES & CODE EXPLORER OVERLAY ────────────── */}
      <AnimatePresence>
        {isFileTreeOpen && (
          <motion.div
            key="file-tree-viewer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full z-30 flex bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md overflow-hidden"
            style={{ transformOrigin: 'center' }}
          >
            {/* Left: Interactive File Tree panel */}
            <div className="w-72 sm:w-80 md:w-88 border-r border-zinc-200/80 dark:border-white/[0.06] flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
              <FileTree
                files={repoFiles}
                isLoading={isLoadingFiles}
                repoName={activeRepo?.name}
                selectedPath={selectedFile?.file_path}
                onSelectFile={(file) => setSelectedFile(file)}
              />
            </div>

            {/* Right: Code Inspector preview for selected file */}
            <div className="flex-1 min-w-0 h-full flex flex-col">
              <CodeViewer
                activeFile={selectedFile}
                activeRepo={activeRepo}
                onClose={() => setIsFileTreeOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Conversation History Drawer ─────────────────────────────────── */}
      <ConversationHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearAllConversations={handleClearAllConversations}
        isLoading={isLoadingHistory}
        repoName={activeRepo?.name}
      />
    </div>
  );
}

// ── Replit-Inspired Empty State Component ──────────────────────────────────
function ReplitEmptyState({
  repositories,
  activeRepo,
  selectedRepoId,
  isSubmitting,
  starterPrompts,
  onSendMessage,
  onSelectRepo,
}: {
  repositories: Repository[];
  activeRepo: Repository | null;
  selectedRepoId: number | null;
  isSubmitting: boolean;
  starterPrompts: { label: string; icon: React.ComponentType<{ className?: string }>; query: string }[];
  onSendMessage: (text: string) => void;
  onSelectRepo: (repoId: number) => void;
}) {
  const { user } = useUser();
  const displayName = user?.firstName || user?.username || 'there';

  // Show up to 3 most recent repos
  const recentRepos = repositories.slice(0, 3);

  return (
    <div className="flex h-full flex-col items-center justify-start pt-1 sm:pt-2 max-w-2xl mx-auto px-4 select-none">
      {/* ── Recent Projects (Positioned near header) ──────────────────── */}
      {recentRepos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mb-12 sm:mb-16 md:mb-20"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5 font-sans-ui">
            Recent projects
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {recentRepos.map((repo) => {
              const isSelected = selectedRepoId === repo.id;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => onSelectRepo(repo.id)}
                  className={`group text-left rounded-xl border p-2.5 sm:p-3 transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'border-orange-500/40 bg-orange-500/[0.08] shadow-xs'
                      : 'border-zinc-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/[0.12] hover:bg-white dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-200 truncate font-sans-ui mb-1">
                    {repo.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-500 font-code">
                    <FolderGit2 className="w-3 h-3 text-zinc-400" />
                    <span className="truncate">{repo.owner}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{repo.branch || 'main'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Personalized Greeting (Single Line) ───────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-6 max-w-4xl w-full"
      >
        <h1 className="text-xl sm:text-2xl md:text-[28px] lg:text-[32px] font-bold tracking-tight text-zinc-900 dark:text-white font-sans-ui whitespace-nowrap">
          {displayName}, what are we working on today?
        </h1>
        {activeRepo && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans-ui mt-1.5">
            Currently exploring <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{activeRepo.name}</span>
          </p>
        )}
      </motion.div>

      {/* ── Suggested Prompts (Slim Sleek Pills) ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="text-[10.5px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-sans-ui">
            Suggested for you
          </span>
          <Sparkles className="w-3 h-3 text-orange-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          {starterPrompts.slice(0, 3).map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(item.query)}
                disabled={!selectedRepoId || isSubmitting}
                className="group flex items-center gap-2.5 rounded-xl border border-zinc-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] px-3.5 py-2 text-left text-[12.5px] text-zinc-700 dark:text-zinc-300 hover:border-orange-500/40 hover:bg-orange-500/[0.04] hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer font-sans-ui disabled:opacity-50 shadow-2xs"
              >
                <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-orange-500/10 transition-colors">
                  <Icon className="w-3 h-3 text-zinc-500 dark:text-zinc-400 group-hover:text-orange-500 transition-colors" />
                </div>
                <span className="font-medium truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
