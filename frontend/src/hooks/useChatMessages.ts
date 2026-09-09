import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, SourceCitation } from '../types';
import { useApiClient } from '../services/useApiClient';
import { useToast } from '../contexts/ToastContext';
import type { PromptInputBoxHandle } from '../components/ui/PromptInputBox';

interface UseChatMessagesOptions {
  selectedRepoId: number | null;
  conversationId: number | null;
  setConversationId: (id: number) => void;
  onConversationCreated?: (convId: number) => void;
  onSelectCitation?: (citation: SourceCitation) => void;
}

export function useChatMessages({
  selectedRepoId,
  conversationId,
  setConversationId,
  onConversationCreated,
  onSelectCitation,
}: UseChatMessagesOptions) {
  const api = useApiClient();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<number | string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<PromptInputBoxHandle>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, scrollToBottom]);

  // Clean up any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsSubmitting(false);
    toast.info('Generation stopped');
  }, [toast]);

  const handleCopyMessage = useCallback(
    async (msgId: number | string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedMsgId(msgId);
        toast.success('Response copied to clipboard');
        setTimeout(() => setCopiedMsgId(null), 2000);
      } catch {
        toast.error('Failed to copy to clipboard');
      }
    },
    [toast]
  );

  const handleSendMessage = useCallback(
    async (textFromComposer?: string) => {
      const userText = (textFromComposer ?? '').trim();
      if (!userText || !selectedRepoId || isSubmitting) return;

      setErrorMessage(null);
      setSuggestedQuestions([]);

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
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

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
                onConversationCreated?.(convId);
              }
            },
            onCitations: (sources) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, sources } : msg
                )
              );
              if (sources && sources.length > 0) {
                onSelectCitation?.(sources[0]);
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
                onConversationCreated?.(conversationId || savedId);
              }
            },
            onError: (err) => {
              setErrorMessage(err);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId && !msg.content
                    ? { ...msg, content: `⚠️ ${err}` }
                    : msg
                )
              );
            },
            onSuggestions: (questions) => {
              setSuggestedQuestions(questions);
            },
          },
          controller.signal
        );
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          // Stream was cancelled by user; keep whatever content was streamed so far
          return;
        }

        const msg = err.message || 'An error occurred while answering your question.';
        setErrorMessage(msg);
        toast.error(msg);

        setMessages((prev) =>
          prev.filter(
            (m) =>
              m.id !== assistantMsgId ||
              (Boolean(m.content) && m.content.trim().length > 0)
          )
        );
      } finally {
        abortControllerRef.current = null;
        setIsSubmitting(false);
        setIsStreaming(false);

        setSuggestedQuestions((prev) => {
          if (prev && prev.length > 0) return prev;
          const qLower = (userText || '').toLowerCase();
          if (
            qLower.includes('auth') ||
            qLower.includes('login') ||
            qLower.includes('user') ||
            qLower.includes('clerk')
          ) {
            return [
              'How is user session validation handled?',
              'Where are protected routes configured?',
              'What auth tokens are passed in API requests?',
            ];
          }
          if (
            qLower.includes('api') ||
            qLower.includes('route') ||
            qLower.includes('endpoint') ||
            qLower.includes('controller')
          ) {
            return [
              'What validation middleware protects these endpoints?',
              'How are API error responses formatted?',
              'Are these routes rate-limited?',
            ];
          }
          if (
            qLower.includes('db') ||
            qLower.includes('database') ||
            qLower.includes('sql') ||
            qLower.includes('table') ||
            qLower.includes('model')
          ) {
            return [
              'How are database connection pools configured?',
              'What indexes are defined for this model?',
              'Can you show the database schema for this table?',
            ];
          }
          return [
            'How does this connect with the rest of the application?',
            'What are the primary entry points for this feature?',
            'What are potential edge cases or performance considerations?',
          ];
        });

        composerRef.current?.focus();
      }
    },
    [
      selectedRepoId,
      conversationId,
      isSubmitting,
      api,
      setConversationId,
      onConversationCreated,
      onSelectCitation,
      toast,
    ]
  );

  return {
    messages,
    setMessages,
    isSubmitting,
    isStreaming,
    errorMessage,
    setErrorMessage,
    persistenceWarning,
    setPersistenceWarning,
    suggestedQuestions,
    setSuggestedQuestions,
    copiedMsgId,
    messagesEndRef,
    composerRef,
    scrollToBottom,
    handleSendMessage,
    handleStopGenerating,
    handleCopyMessage,
  };
}
