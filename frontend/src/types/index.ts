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

/** Repository Intelligence Report types */
export interface LanguageMetric {
  language: string;
  file_count: number;
  line_count: number;
  byte_size: number;
  percentage: number;
  color: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'runtime' | 'dev';
  category: string;
}

export interface EntryPoint {
  file_path: string;
  name: string;
  language: string;
  description: string;
}

export interface DirectoryInfo {
  path: string;
  file_count: number;
  description: string;
}

export interface DetectedApi {
  method: string;
  path: string;
  file: string;
}

export interface AIAnalysis {
  executive_summary: string;
  architecture_style: string;
  architecture_deep_dive: string;
  key_features: Array<{ title: string; description: string }>;
  security_and_performance: Array<{ aspect: string; observation: string; recommendation?: string }>;
  onboarding_guide: Array<{ step: number; title: string; detail: string }>;
  recommended_questions: string[];
}

export interface RepositoryReport {
  repository_id: number;
  repo_name: string;
  owner: string;
  github_url: string;
  branch: string;
  generated_at: string;
  metrics: {
    total_files: number;
    total_lines: number;
    total_size_bytes: number;
    languages: LanguageMetric[];
  };
  manifests: string[];
  dependencies: DependencyInfo[];
  scripts: Record<string, string>;
  entry_points: EntryPoint[];
  key_directories: DirectoryInfo[];
  detected_apis: DetectedApi[];
  ai_analysis: AIAnalysis;
}
