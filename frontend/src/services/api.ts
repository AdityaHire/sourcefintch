/**
 * API service layer — all HTTP calls live here.
 *
 * Each function takes an `authedFetch` (a `fetch`-shaped function that
 * attaches `Authorization: Bearer <clerk-token>`) so callers from
 * `useApiClient` get authenticated calls without bypassing the wrapper.
 *
 * The AI service is called directly (no token) because that service is
 * the same-origin backend from a network perspective and only accepts
 * x-internal-secret from the Python side, never browser-originated calls.
 */

import type {
  HealthResponse,
  Repository,
  Conversation,
  ChatResponse,
} from '../types';

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export type AuthedFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const jsonOrThrow = async (res: Response, fallback: string) => {
  if (res.ok) return res.json();
  const data = await res.json().catch(() => ({}));
  const err: any = new Error(data.message || fallback);
  err.statusCode = res.status;
  err.details = data;
  throw err;
};

export async function checkBackendHealth(_authedFetch?: AuthedFetch): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function checkAIServiceHealth(): Promise<HealthResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/health`);
  if (!res.ok) throw new Error(`AI service returned ${res.status}`);
  return res.json();
}

export async function fetchCompletedRepositories(
  authedFetch: AuthedFetch
): Promise<Repository[]> {
  const res = await authedFetch('/api/repositories');
  return jsonOrThrow(res, 'Failed to fetch repositories');
}

export async function createConversation(
  authedFetch: AuthedFetch,
  repositoryId: number,
  title?: string
): Promise<Conversation> {
  const res = await authedFetch('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ repository_id: repositoryId, title }),
  });
  return jsonOrThrow(res, 'Failed to create conversation');
}

export async function fetchConversation(
  authedFetch: AuthedFetch,
  conversationId: number
): Promise<Conversation> {
  const res = await authedFetch(`/api/conversations/${conversationId}`);
  return jsonOrThrow(res, 'Failed to fetch conversation');
}

export async function createRepository(
  authedFetch: AuthedFetch,
  githubUrl: string,
  branch?: string
): Promise<{ id: number; name: string; status: string }> {
  const res = await authedFetch('/api/repositories', {
    method: 'POST',
    body: JSON.stringify({ github_url: githubUrl, branch: branch || undefined }),
  });
  return jsonOrThrow(res, 'Failed to add repository');
}

export async function getRepository(
  authedFetch: AuthedFetch,
  id: number
): Promise<Repository> {
  const res = await authedFetch(`/api/repositories/${id}`);
  return jsonOrThrow(res, 'Failed to fetch repository');
}

export async function deleteRepository(
  authedFetch: AuthedFetch,
  id: number
): Promise<{ success: boolean; id: number }> {
  const res = await authedFetch(`/api/repositories/${id}`, { method: 'DELETE' });
  return jsonOrThrow(res, 'Failed to delete repository');
}

export async function getRepositoryFiles(
  authedFetch: AuthedFetch,
  id: number
): Promise<import('../types').RepositoryFile[]> {
  const res = await authedFetch(`/api/repositories/${id}/files`);
  return jsonOrThrow(res, 'Failed to fetch repository files');
}

export async function sendChatMessage(
  authedFetch: AuthedFetch,
  payload: {
    conversation_id?: number;
    repository_id: number;
    message: string;
    new_conversation?: boolean;
  }
): Promise<ChatResponse> {
  const res = await authedFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res, 'Chat request failed');
}