/**
 * API service layer — all HTTP calls live here.
 *
 * Using plain `fetch` instead of axios to keep dependencies minimal.
 * Each function returns the parsed JSON or throws on failure.
 */

import type {
  HealthResponse,
  Repository,
  Conversation,
  ChatResponse,
} from '../types';

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Check the Node.js backend health.
 * Uses the Vite proxy, so we just call `/api/health` (no port needed).
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

/**
 * Check the Python AI service health.
 * Called directly (not proxied) because it's a separate server.
 */
export async function checkAIServiceHealth(): Promise<HealthResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/health`);
  if (!res.ok) throw new Error(`AI service returned ${res.status}`);
  return res.json();
}

/**
 * Fetch all completed repositories available for querying.
 */
export async function fetchCompletedRepositories(): Promise<Repository[]> {
  const res = await fetch('/api/repositories');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch repositories (${res.status})`);
  }
  return res.json();
}

/**
 * Create a new conversation thread.
 */
export async function createConversation(
  repositoryId: number,
  title?: string
): Promise<Conversation> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repository_id: repositoryId, title }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to create conversation (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch a conversation by ID with its full message history.
 */
export async function fetchConversation(conversationId: number): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${conversationId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch conversation (${res.status})`);
  }
  return res.json();
}

/**
 * Trigger ingestion for a new GitHub repository.
 */
export async function createRepository(
  githubUrl: string,
  branch?: string
): Promise<{ id: number; name: string; status: string }> {
  const res = await fetch('/api/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: githubUrl, branch: branch || undefined }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(data.message || `Failed to add repository (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Fetch a single repository's status by ID.
 */
export async function getRepository(id: number): Promise<Repository> {
  const res = await fetch(`/api/repositories/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch repository (${res.status})`);
  }
  return res.json();
}

/**
 * Delete a repository and its associated indexed chunks.
 */
export async function deleteRepository(id: number): Promise<{ success: boolean; id: number }> {
  const res = await fetch(`/api/repositories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to delete repository (${res.status})`);
  }
  return res.json();
}

/**
 * Send a chat message through Node's orchestrator.
 */
export async function sendChatMessage(payload: {
  conversation_id?: number;
  repository_id: number;
  message: string;
  new_conversation?: boolean;
}): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(data.message || `Chat request failed (${res.status})`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }

  return res.json();
}
