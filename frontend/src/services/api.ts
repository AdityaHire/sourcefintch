/**
 * API service layer — all HTTP calls live here.
 *
 * Using plain `fetch` instead of axios to keep dependencies minimal.
 * Each function returns the parsed JSON or throws on failure.
 */

import type { HealthResponse } from '../types';

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
