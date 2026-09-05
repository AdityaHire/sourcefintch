/**
 * useApiClient — single source of truth for backend HTTP calls.
 *
 * Returns a STABLE object reference across renders.  The previous
 * implementation returned a fresh literal each render, which made any
 * downstream `useEffect([api])` re-run on every parent re-render (hover,
 * state change).  With Clerk's session validation that caused a visible
 * flicker because the auth status briefly toggled.
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import * as api from './api';

export type AuthedFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export function useApiClient() {
  // CRITICAL: call hooks unconditionally at the top of the component —
  // never gate early returns on isLoaded/isSignedIn (causes "Rendered more
  // hooks than previous render" crashes on hot reload / sign-in transitions).
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      if (isSignedIn) {
        const token = await getToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
      }
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(input, { ...init, headers });
    },
    [getToken, isSignedIn]
  );

  const client = useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      authedFetch,
      checkBackendHealth: () => api.checkBackendHealth(authedFetch),
      checkAIServiceHealth: () => api.checkAIServiceHealth(),
      fetchCompletedRepositories: () => api.fetchCompletedRepositories(authedFetch),
      createConversation: (repositoryId: number, title?: string) =>
        api.createConversation(authedFetch, repositoryId, title),
      fetchConversation: (conversationId: number) =>
        api.fetchConversation(authedFetch, conversationId),
      createRepository: (githubUrl: string, branch?: string) =>
        api.createRepository(authedFetch, githubUrl, branch),
      getRepository: (id: number) => api.getRepository(authedFetch, id),
      getRepositoryFiles: (id: number) => api.getRepositoryFiles(authedFetch, id),
      deleteRepository: (id: number) => api.deleteRepository(authedFetch, id),
      sendChatMessage: (payload: Parameters<typeof api.sendChatMessage>[1]) =>
        api.sendChatMessage(authedFetch, payload),
      streamChatMessage: (
        payload: Parameters<typeof api.streamChatMessage>[1],
        callbacks: Parameters<typeof api.streamChatMessage>[2],
        signal?: AbortSignal
      ) => api.streamChatMessage(authedFetch, payload, callbacks, signal),
    }),
    [isLoaded, isSignedIn, authedFetch]
  );

  return client;
}

export type ApiClient = ReturnType<typeof useApiClient>;