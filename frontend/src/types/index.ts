/**
 * Shared TypeScript types used across the frontend.
 */

/** The possible states a service health check can be in. */
export type ServiceStatus = 'checking' | 'online' | 'unreachable';

/** Shape of the response from either health endpoint. */
export interface HealthResponse {
  status: string;
  service: string;
  timestamp?: string;
}

/** Props for the ServiceStatusCard component. */
export interface ServiceCardProps {
  name: string;
  description: string;
  status: ServiceStatus;
  responseData?: HealthResponse | null;
}

/** Completed repository shape for selector and queries. */
export interface Repository {
  id: number;
  name: string;
  owner: string;
  github_url: string;
  branch: string;
  file_count: number;
  status: string;
  created_at: string;
}

/** Citation chip with traceable file, line bounds, score, and chunk content. */
export interface SourceCitation {
  file_path: string;
  start_line: number;
  end_line: number;
  code_chunk_id?: number | string | null;
  score: number;
  content?: string;
}

/** Single message in a conversation thread. */
export interface ChatMessage {
  id?: number | null;
  conversation_id?: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[] | null;
  created_at?: string;
}

/** Full conversation thread with messages. */
export interface Conversation {
  id: number;
  user_id: number;
  repository_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

/** Response from POST /api/chat. */
export interface RepositoryFile {
  id: number;
  repository_id: number;
  file_path: string;
  language?: string | null;
  file_size?: number;
  content?: string | null;
}

export interface ChatResponse {
  conversation_id: number;
  message: {
    id?: number | null;
    role: 'assistant';
    content: string;
    sources: SourceCitation[];
  };
  persistence_warning?: boolean;
}
