import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Bug, Layers, Code2, FileSearch } from 'lucide-react';
import Sidebar, { type SidebarTab } from './Sidebar';
import { Banner } from './ui/Banner';
import { Skeleton } from './ui/Skeleton';
import { PromptInputBox } from './ui/PromptInputBox';
import FileTree from './ui/file-tree';
import { ChatTopBar } from './ChatTopBar';
import { ChatMessageList } from './ChatMessageList';
import { ReplitEmptyState } from './ReplitEmptyState';

import { useApiClient } from '../services/useApiClient';
import { useTheme } from '../contexts/ThemeContext';
import { useChatMessages } from '../hooks/useChatMessages';
import { useConversationManager } from '../hooks/useConversationManager';
import { useFileExplorer } from '../hooks/useFileExplorer';
import { useCitationViewer } from '../hooks/useCitationViewer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

import type { Repository } from '../types';

// Lazy-load heavier overlay components for better bundle splitting
const CodeViewer = lazy(() => import('./CodeViewer'));
const ConversationHistoryDrawer = lazy(() =>
  import('./ConversationHistoryDrawer').then((m) => ({
    default: m.ConversationHistoryDrawer,
  }))
);

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
    theme: propTheme,
    setTheme: propSetTheme,
  } = props;

  const { theme: contextTheme, setTheme: contextSetTheme } = useTheme();
  const theme = propTheme ?? contextTheme;
  const setTheme = propSetTheme ?? contextSetTheme;

  const api = useApiClient();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // ── 1. Citation Viewer Hook ───────────────────────────────────────────────
  const citationViewer = useCitationViewer({
    onSendMessage: (prompt) => chatMessages.handleSendMessage(prompt),
    onSetPromptText: (text) => {
      chatMessages.composerRef.current?.setText(text);
      chatMessages.composerRef.current?.focus();
    },
    onCloseFileTree: () => fileExplorer.setIsFileTreeOpen(false),
  });

  // ── 2. File Explorer Hook ────────────────────────────────────────────────
  const fileExplorer = useFileExplorer({
    selectedRepoId,
    onCodeViewerClose: () => citationViewer.closeCodeViewer(),
  });

  // ── 3. Conversation Manager Hook ─────────────────────────────────────────
  const convManager = useConversationManager({
    selectedRepoId,
    onConversationLoaded: (loadedMessages, firstCitation) => {
      chatMessages.setMessages(loadedMessages);
      if (firstCitation) {
        citationViewer.setSelectedCitation(firstCitation);
      }
    },
    onNewChatInitiated: () => {
      chatMessages.setPersistenceWarning(false);
      chatMessages.setMessages([]);
      citationViewer.setSelectedCitation(null);
      citationViewer.closeCodeViewer();
      chatMessages.setErrorMessage(null);
      chatMessages.composerRef.current?.focus();
    },
    onError: (err) => {
      chatMessages.setErrorMessage(err);
    },
  });

  // ── 4. Chat Messages Hook ────────────────────────────────────────────────
  const chatMessages = useChatMessages({
    selectedRepoId,
    conversationId: convManager.conversationId,
    setConversationId: convManager.setConversationId,
    onConversationCreated: () => {
      if (selectedRepoId) {
        convManager.loadConversations(selectedRepoId);
      }
    },
    onSelectCitation: (citation) => {
      citationViewer.setSelectedCitation(citation);
    },
  });

  // ── 5. Keyboard Shortcuts Hook ───────────────────────────────────────────
  useKeyboardShortcuts({
    onNewChat: () => convManager.handleNewChat(),
    onToggleFileTree: () => fileExplorer.handleToggleFileTree(),
    onToggleHistory: () => convManager.setIsHistoryOpen((prev) => !prev),
    onEscape: () => {
      if (citationViewer.isCodeViewerOpen) citationViewer.closeCodeViewer();
      else if (fileExplorer.isFileTreeOpen) fileExplorer.setIsFileTreeOpen(false);
      else if (convManager.isHistoryOpen) convManager.setIsHistoryOpen(false);
    },
  });

  // ── 6. Initial Load: Repositories & URL Search Param ─────────────────────
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoadingRepos(true);
      try {
        const repos = await api.fetchCompletedRepositories();
        if (!isMounted) return;
        setRepositories(repos);

        const params = new URLSearchParams(window.location.search);
        const convParam = params.get('conversationId');

        if (convParam && !isNaN(Number(convParam))) {
          const convId = Number(convParam);
          convManager.handleSelectConversation(convId);
        } else if (repos.length > 0) {
          setSelectedRepoId(repos[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        chatMessages.setErrorMessage(err.message || 'Failed to load repositories');
      } finally {
        if (isMounted) setIsLoadingRepos(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Repository selection and deletion handlers ───────────────────────────
  const handleRepoChange = (newRepoId: number) => {
    setSelectedRepoId(newRepoId);
    convManager.handleNewChat();
    chatMessages.setMessages([]);
    chatMessages.setErrorMessage(null);
    citationViewer.closeCodeViewer();
    fileExplorer.resetFiles();
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
          convManager.handleNewChat();
          chatMessages.setMessages([]);
          citationViewer.closeCodeViewer();
        }
      }
      return remaining;
    });
  };

  const activeRepo = useMemo(
    () => repositories.find((r) => r.id === selectedRepoId) || null,
    [repositories, selectedRepoId]
  );

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
        theme={theme}
        setTheme={setTheme}
      />

      {/* ── 2. CENTER PANEL: Chat Workspace ───────────────────────────────── */}
      <div className="relative flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-transparent">
        {/* Top Repository Bar */}
        <ChatTopBar
          activeRepo={activeRepo}
          isLoadingRepos={isLoadingRepos}
          selectedRepoId={selectedRepoId}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isFileTreeOpen={fileExplorer.isFileTreeOpen}
          onToggleFileTree={fileExplorer.handleToggleFileTree}
          isHistoryOpen={convManager.isHistoryOpen}
          onToggleHistory={() => convManager.setIsHistoryOpen((prev) => !prev)}
          conversationsCount={convManager.conversations.length}
          onNewChat={convManager.handleNewChat}
          isSubmitting={chatMessages.isSubmitting}
          isNewChatDisabled={chatMessages.messages.length === 0 && !convManager.conversationId}
        />

        {/* Error Banner */}
        <Banner
          show={!!chatMessages.errorMessage}
          tone="error"
          onDismiss={() => chatMessages.setErrorMessage(null)}
        >
          {chatMessages.errorMessage}
        </Banner>

        {/* Persistence Warning Banner */}
        <Banner
          show={chatMessages.persistenceWarning}
          tone="warning"
          onDismiss={() => chatMessages.setPersistenceWarning(false)}
        >
          Response shown, but could not be saved to history due to a storage issue.
        </Banner>

        {/* ── Scrollable Conversation Stream ───────────────────────────────── */}
        <div className="relative z-1 flex-1 overflow-y-auto px-4 sm:px-8 py-5 pb-32 select-text">
          {convManager.isLoadingConv ? (
            <div className="space-y-4 max-w-3xl mx-auto w-full px-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : chatMessages.messages.length === 0 ? (
            <ReplitEmptyState
              repositories={repositories}
              isLoadingRepos={isLoadingRepos}
              activeRepo={activeRepo}
              selectedRepoId={selectedRepoId}
              isSubmitting={chatMessages.isSubmitting}
              starterPrompts={starterPrompts}
              onSendMessage={chatMessages.handleSendMessage}
              onSelectRepo={handleRepoChange}
            />
          ) : (
            <ChatMessageList
              messages={chatMessages.messages}
              isSubmitting={chatMessages.isSubmitting}
              copiedMsgId={chatMessages.copiedMsgId}
              selectedCitation={citationViewer.selectedCitation}
              isCodeViewerOpen={citationViewer.isCodeViewerOpen}
              suggestedQuestions={chatMessages.suggestedQuestions}
              selectedRepoId={selectedRepoId}
              onCopyMessage={chatMessages.handleCopyMessage}
              onCitationClick={citationViewer.handleCitationClick}
              onOpenCode={(path, sLine, eLine) =>
                citationViewer.handleOpenCode(
                  path,
                  sLine,
                  eLine,
                  chatMessages.messages,
                  fileExplorer.repoFiles
                )
              }
              onSendMessage={chatMessages.handleSendMessage}
              onClearSuggestions={() => chatMessages.setSuggestedQuestions([])}
              onTypingComplete={chatMessages.scrollToBottom}
              messagesEndRef={chatMessages.messagesEndRef}
            />
          )}
        </div>

        {/* ── 3. Bottom Composer: Floating PromptInputBox with Stop button ─── */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 sm:px-8 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="max-w-2xl xl:max-w-3xl mx-auto w-full">
            <div className="pointer-events-auto">
              <PromptInputBox
                ref={chatMessages.composerRef}
                placeholder={
                  selectedRepoId
                    ? 'Ask anything about this repository...'
                    : 'Select a repository to start'
                }
                disabled={!selectedRepoId || (chatMessages.isSubmitting && !chatMessages.isStreaming)}
                status={
                  chatMessages.isStreaming
                    ? 'streaming'
                    : chatMessages.isSubmitting
                      ? 'sending'
                      : 'idle'
                }
                onSend={chatMessages.handleSendMessage}
                onStop={chatMessages.handleStopGenerating}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. FULLSCREEN CODE INSPECTOR OVERLAY ──────────────────────────── */}
      <AnimatePresence>
        {citationViewer.isCodeViewerOpen && (
          <motion.div
            key="code-viewer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Code Inspector"
            className="absolute inset-0 w-full h-full z-30 flex flex-col bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md"
            style={{ transformOrigin: 'center' }}
          >
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-6 w-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              }
            >
              <CodeViewer
                citation={citationViewer.selectedCitation}
                activeRepo={activeRepo}
                onClose={() => citationViewer.closeCodeViewer()}
                onAskAI={citationViewer.handleAskAIFromCode}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. FULLSCREEN REPO FILES & CODE EXPLORER OVERLAY ────────────── */}
      <AnimatePresence>
        {fileExplorer.isFileTreeOpen && (
          <motion.div
            key="file-tree-viewer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Repository Files Explorer"
            className="absolute inset-0 w-full h-full z-30 flex bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md overflow-hidden"
            style={{ transformOrigin: 'center' }}
          >
            {/* Left: Interactive File Tree panel */}
            <div className="w-72 sm:w-80 md:w-88 border-r border-zinc-200/80 dark:border-white/[0.06] flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
              <FileTree
                files={fileExplorer.repoFiles}
                isLoading={fileExplorer.isLoadingFiles}
                repoName={activeRepo?.name}
                selectedPath={fileExplorer.selectedFile?.file_path}
                onSelectFile={(file) => fileExplorer.handleSelectFile(file)}
              />
            </div>

            {/* Right: Code Inspector preview for selected file */}
            <div className="flex-1 min-w-0 h-full flex flex-col">
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-6 w-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                }
              >
                <CodeViewer
                  activeFile={fileExplorer.selectedFile}
                  activeRepo={activeRepo}
                  isLoading={fileExplorer.isLoadingFileContent}
                  onClose={() => fileExplorer.setIsFileTreeOpen(false)}
                  onAskAI={citationViewer.handleAskAIFromCode}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Conversation History Drawer ───────────────────────────────── */}
      <Suspense fallback={null}>
        <ConversationHistoryDrawer
          isOpen={convManager.isHistoryOpen}
          onClose={() => convManager.setIsHistoryOpen(false)}
          conversations={convManager.conversations}
          activeConversationId={convManager.conversationId}
          onSelectConversation={convManager.handleSelectConversation}
          onNewChat={convManager.handleNewChat}
          onRenameConversation={convManager.handleRenameConversation}
          onDeleteConversation={convManager.handleDeleteConversation}
          onClearAllConversations={convManager.handleClearAllConversations}
          isLoading={convManager.isLoadingHistory}
          repoName={activeRepo?.name}
        />
      </Suspense>
    </div>
  );
}
