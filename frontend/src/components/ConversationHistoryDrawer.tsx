import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import type { Conversation } from '../types';
import { appleSprings, haptics } from '../lib/applePhysics';

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onRenameConversation: (id: number, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  onClearAllConversations?: () => Promise<void>;
  isLoading: boolean;
  repoName?: string;
}

export function ConversationHistoryDrawer({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onClearAllConversations,
  isLoading,
  repoName,
}: ConversationHistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const filteredConversations = conversations.filter((c) =>
    (c.title || 'Untitled Conversation').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    haptics.trigger('light');
    setEditingId(conv.id);
    setEditTitle(conv.title || 'Untitled Conversation');
  };

  const handleSaveRename = async (e: React.MouseEvent | React.FormEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    haptics.trigger('medium');
    await onRenameConversation(id, editTitle.trim());
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.trigger('light');
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    haptics.trigger('medium');
    if (deletingId === id) {
      await onDeleteConversation(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              haptics.trigger('light');
              onClose();
            }}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          />

          {/* Drawer Panel - Apple Translucent Sheet with Spring Motion */}
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={appleSprings.snappy}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-80 md:w-96 bg-white/90 dark:bg-[#0c0d0f]/90 backdrop-blur-2xl backdrop-saturate-180 border-l border-zinc-200/80 dark:border-white/[0.08] z-50 flex flex-col shadow-2xl shadow-black/25 select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200/80 dark:border-white/[0.08] border-t border-t-white/80 dark:border-t-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold text-zinc-900 dark:text-white font-sans-ui truncate tracking-tight">
                    Chat History
                  </h2>
                  {repoName && (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-code truncate">
                      {repoName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    haptics.trigger('medium');
                    onNewChat();
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.08] px-2 py-1 rounded-md transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                  title="Start a new chat thread"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.trigger('light');
                    onClose();
                  }}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                  title="Close history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-zinc-100 dark:border-white/[0.04]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/20 focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans-ui"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.trigger('light');
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-xs">
                  <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-700 dark:border-t-zinc-200 rounded-full animate-spin mb-2" />
                  <span>Loading conversations...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <FolderGit2 className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 font-sans-ui">
                    {searchQuery ? 'No matching conversations' : 'No chat history yet'}
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-[200px] mx-auto font-sans-ui">
                    {searchQuery
                      ? 'Try searching with different keywords'
                      : 'Ask a question in this repository to begin a conversation thread.'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isEditing = editingId === conv.id;
                  const isDeleting = deletingId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (!isEditing) {
                          haptics.trigger('selection');
                          onSelectConversation(conv.id);
                        }
                      }}
                      className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 transition-all cursor-pointer select-none text-left active:scale-[0.98] ${
                        isActive
                          ? 'bg-zinc-100/90 dark:bg-white/[0.08] border border-zinc-300/80 dark:border-white/[0.14] text-zinc-900 dark:text-white font-medium shadow-2xs'
                          : 'hover:bg-zinc-100/70 dark:hover:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 border border-transparent'
                      }`}
                    >
                      {/* Left: Icon & Content */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive
                              ? 'text-zinc-800 dark:text-zinc-100'
                              : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                          }`}
                        />

                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleSaveRename(e, conv.id)}
                            className="flex items-center gap-1 w-full"
                          >
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              autoFocus
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-500/50 rounded px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title="Save title"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelRename}
                              className="p-1 text-zinc-400 hover:text-zinc-600"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate font-sans-ui">
                              {conv.title || 'Untitled Conversation'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formatRelativeTime(conv.updated_at || conv.created_at)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Action buttons */}
                      {!isEditing && (
                        <div
                          className={`flex items-center gap-1 shrink-0 transition-opacity ${
                            isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isDeleting ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, conv.id)}
                                className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10.5px] font-medium transition-colors shadow-xs active:scale-95"
                                title="Permanently delete conversation"
                              >
                                <span>Delete</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  haptics.trigger('light');
                                  setDeletingId(null);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(e, conv)}
                                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/50 dark:hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 active:scale-90"
                                title="Rename conversation"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, conv.id)}
                                className="p-1 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-90"
                                title="Delete conversation"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Arrow indicator when active and not hovering */}
                      {isActive && !isEditing && !isDeleting && (
                        <ChevronRight className="w-3 h-3 text-zinc-700 dark:text-zinc-200 shrink-0 group-hover:hidden" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Clear All */}
            {conversations.length > 0 && onClearAllConversations && (
              <div className="p-3 border-t border-zinc-100 dark:border-white/[0.04] shrink-0">
                {isClearingAll ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-rose-500/[0.08] border border-rose-500/20 rounded-lg">
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium font-sans-ui">
                      Delete all {conversations.length} conversations?
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          haptics.trigger('medium');
                          await onClearAllConversations();
                          setIsClearingAll(false);
                        }}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-medium transition-colors active:scale-95"
                      >
                        Yes, delete all
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsClearingAll(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.trigger('light');
                      setIsClearingAll(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer font-sans-ui active:scale-98"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All History</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
