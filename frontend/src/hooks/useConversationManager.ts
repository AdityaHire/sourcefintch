import { useState, useEffect, useCallback } from 'react';
import type { Conversation, ChatMessage, SourceCitation } from '../types';
import { useApiClient } from '../services/useApiClient';
import { useToast } from '../contexts/ToastContext';

interface UseConversationManagerOptions {
  selectedRepoId: number | null;
  onConversationLoaded?: (messages: ChatMessage[], firstCitation?: SourceCitation) => void;
  onNewChatInitiated?: () => void;
  onError?: (msg: string) => void;
}

export function useConversationManager({
  selectedRepoId,
  onConversationLoaded,
  onNewChatInitiated,
  onError,
}: UseConversationManagerOptions) {
  const api = useApiClient();
  const { toast } = useToast();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const handleNewChat = useCallback(() => {
    setConversationId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    window.history.pushState(null, '', url.pathname + url.search);
    onNewChatInitiated?.();
  }, [onNewChatInitiated]);

  const handleSelectConversation = useCallback(
    async (convId: number) => {
      if (convId === conversationId) {
        setIsHistoryOpen(false);
        return;
      }
      setConversationId(convId);
      setIsLoadingConv(true);
      setIsHistoryOpen(false);

      const url = new URL(window.location.href);
      url.searchParams.set('conversationId', String(convId));
      window.history.pushState(null, '', url.pathname + url.search);

      try {
        const convData = await api.fetchConversation(convId);
        const msgs = convData.messages || [];
        const firstWithSources = msgs.find(
          (m) => m.role === 'assistant' && m.sources && m.sources.length > 0
        );
        const citation = firstWithSources?.sources?.[0];
        onConversationLoaded?.(msgs, citation);
      } catch (err: any) {
        const errorMsg = `Failed to load conversation #${convId}: ${err.message}`;
        onError?.(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsLoadingConv(false);
      }
    },
    [conversationId, api, onConversationLoaded, onError, toast]
  );

  // Optimistic Rename with Rollback
  const handleRenameConversation = useCallback(
    async (convId: number, newTitle: string) => {
      const original = conversations.find((c) => c.id === convId);
      if (!original) return;

      // Optimistic update
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
      );

      try {
        const updated = await api.updateConversation(convId, newTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c))
        );
        toast.success('Conversation renamed');
      } catch (err: any) {
        // Rollback
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: original.title } : c))
        );
        const errorMsg = `Failed to rename conversation: ${err.message}`;
        onError?.(errorMsg);
        toast.error(errorMsg);
      }
    },
    [conversations, api, onError, toast]
  );

  // Optimistic Delete with Rollback
  const handleDeleteConversation = useCallback(
    async (convId: number) => {
      const originalList = [...conversations];

      // Optimistic update
      setConversations((prev) => prev.filter((c) => c.id !== convId));

      try {
        await api.deleteConversation(convId);
        toast.success('Conversation deleted');
        if (conversationId === convId) {
          handleNewChat();
        }
      } catch (err: any) {
        // Rollback
        setConversations(originalList);
        const errorMsg = `Failed to delete conversation: ${err.message}`;
        onError?.(errorMsg);
        toast.error(errorMsg);
      }
    },
    [conversations, conversationId, api, handleNewChat, onError, toast]
  );

  const handleClearAllConversations = useCallback(async () => {
    if (!selectedRepoId) return;
    const originalList = [...conversations];
    setConversations([]);
    try {
      await api.deleteAllConversations(selectedRepoId);
      toast.success('All conversations cleared');
      handleNewChat();
    } catch (err: any) {
      setConversations(originalList);
      const errorMsg = `Failed to clear conversations: ${err.message}`;
      onError?.(errorMsg);
      toast.error(errorMsg);
    }
  }, [selectedRepoId, conversations, api, handleNewChat, onError, toast]);

  return {
    conversationId,
    setConversationId,
    conversations,
    setConversations,
    isLoadingConv,
    setIsLoadingConv,
    isLoadingHistory,
    isHistoryOpen,
    setIsHistoryOpen,
    loadConversations,
    handleSelectConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleClearAllConversations,
    handleNewChat,
  };
}
