import { Menu, FolderTree, History, Plus } from 'lucide-react';
import type { Repository } from '../types';
import { StatusDot } from './ui/StatusDot';
import { haptics } from '../lib/applePhysics';

interface ChatTopBarProps {
  activeRepo: Repository | null;
  isLoadingRepos: boolean;
  selectedRepoId: number | null;
  onOpenMobileSidebar: () => void;
  isFileTreeOpen: boolean;
  onToggleFileTree: () => void;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  conversationsCount: number;
  onNewChat: () => void;
  isSubmitting: boolean;
  isNewChatDisabled: boolean;
}

export function ChatTopBar({
  activeRepo,
  isLoadingRepos,
  selectedRepoId,
  onOpenMobileSidebar,
  isFileTreeOpen,
  onToggleFileTree,
  isHistoryOpen,
  onToggleHistory,
  conversationsCount,
  onNewChat,
  isSubmitting,
  isNewChatDisabled,
}: ChatTopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/[0.06] border-t border-t-white/80 dark:border-t-white/10 bg-white/75 dark:bg-[#0c0d0f]/75 backdrop-blur-2xl backdrop-saturate-180 px-4 sm:px-6 py-2.5 sm:py-3 shrink-0 z-20 shadow-2xs">
      {/* Left: Dominant repo name + branch & indexed status */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            onOpenMobileSidebar();
          }}
          className="md:hidden rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors active:scale-95"
          title="Open repositories"
          aria-label="Open repositories sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
          {isLoadingRepos ? (
            <div
              className="h-4 w-36 animate-pulse rounded-md bg-zinc-200 dark:bg-white/[0.08]"
              aria-label="Loading repository"
            />
          ) : (
            <span className="text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui truncate">
              {activeRepo ? `${activeRepo.owner} / ${activeRepo.name}` : 'Select a Repository'}
            </span>
          )}

          {activeRepo && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-sans-ui sm:text-[12px]">
              <span className="rounded-md bg-zinc-100/90 dark:bg-white/[0.06] border border-zinc-200/80 dark:border-white/[0.08] px-2 py-0.5 font-code text-[11px] text-zinc-700 dark:text-zinc-300 font-medium tracking-wide">
                {activeRepo.branch || 'main'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span>{activeRepo.file_count || 0} files</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-medium">
                <StatusDot
                  status={
                    activeRepo.status === 'completed'
                      ? 'online'
                      : activeRepo.status === 'failed'
                        ? 'failed'
                        : 'checking'
                  }
                  label={activeRepo.status === 'completed' ? 'Indexed' : activeRepo.status || 'Indexing'}
                  className="text-[12px]"
                />
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
          onClick={() => {
            haptics.trigger('selection');
            onToggleFileTree();
          }}
          disabled={!selectedRepoId}
          className={`h-[30px] sm:h-[32px] flex items-center gap-1.5 rounded-lg border px-3 sm:px-3.5 text-xs font-semibold transition-all cursor-pointer font-sans-ui disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
            isFileTreeOpen
              ? 'bg-zinc-900 dark:bg-white/20 text-white border-zinc-800 dark:border-white/20 shadow-xs'
              : 'bg-white/80 dark:bg-white/[0.05] border-zinc-200/80 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-white border-t-white/90 dark:border-t-white/20'
          }`}
          title={isFileTreeOpen ? 'Hide folder structure (Ctrl+/)' : 'Show folder structure (Ctrl+/)'}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isFileTreeOpen ? 'Hide Files' : 'Files'}</span>
        </button>

        {/* History toggle button */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('selection');
            onToggleHistory();
          }}
          disabled={!selectedRepoId}
          className={`h-[30px] sm:h-[32px] flex items-center gap-1.5 rounded-lg border px-3 sm:px-3.5 text-xs font-semibold transition-all cursor-pointer font-sans-ui disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
            isHistoryOpen
              ? 'bg-zinc-900 dark:bg-white/20 text-white border-zinc-800 dark:border-white/20 shadow-xs'
              : 'bg-white/80 dark:bg-white/[0.05] border-zinc-200/80 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-white border-t-white/90 dark:border-t-white/20'
          }`}
          title="View past conversations (Ctrl+H)"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">History</span>
          {conversationsCount > 0 && (
            <span className="rounded-full bg-zinc-200/80 dark:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 text-[10px] px-1.5 py-0.2 font-code font-semibold">
              {conversationsCount}
            </span>
          )}
        </button>

        {/* Primary Action: + New Chat */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('medium');
            onNewChat();
          }}
          disabled={isSubmitting || isNewChatDisabled}
          className="h-[30px] sm:h-[32px] flex items-center gap-1.5 rounded-lg border border-transparent border-t-white/30 dark:border-t-white/50 bg-zinc-950 text-white px-3.5 sm:px-4 text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed font-sans-ui active:scale-[0.96]"
          title="New Chat (Ctrl+K)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>
    </header>
  );
}

export default ChatTopBar;
