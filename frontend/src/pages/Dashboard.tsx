import { useEffect, useState } from 'react';
import ServiceStatusCard from '../components/ServiceStatusCard';
import { checkBackendHealth, checkAIServiceHealth } from '../services/api';
import type { ServiceStatus, HealthResponse } from '../types';

/**
 * Dashboard page — the main landing page that shows the health status of
 * both backend services. Calls both health endpoints on mount and displays
 * the results in status cards.
 */
export default function Dashboard() {
  const [backendStatus, setBackendStatus] = useState<ServiceStatus>('checking');
  const [aiStatus, setAIStatus] = useState<ServiceStatus>('checking');
  const [backendData, setBackendData] = useState<HealthResponse | null>(null);
  const [aiData, setAIData] = useState<HealthResponse | null>(null);

  useEffect(() => {
    // Check both services in parallel on mount
    checkBackendHealth()
      .then((data) => {
        setBackendData(data);
        setBackendStatus('online');
      })
      .catch(() => setBackendStatus('unreachable'));

    checkAIServiceHealth()
      .then((data) => {
        setAIData(data);
        setAIStatus('online');
      })
      .catch(() => setAIStatus('unreachable'));
  }, []);

  const allOnline = backendStatus === 'online' && aiStatus === 'online';
  const anyChecking =
    backendStatus === 'checking' || aiStatus === 'checking';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/8 blur-[128px]" />
        <div className="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-violet-600/8 blur-[128px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-16">
        {/* Logo & Title */}
        <header className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Phase 1 — Project Setup
          </div>

          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Sourcefinch
            </span>
          </h1>
          <p className="mx-auto max-w-lg text-lg text-zinc-400">
            AI-powered codebase intelligence — connect a repo, ask questions,
            get answers with source citations.
          </p>
        </header>

        {/* System Status Banner */}
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          {anyChecking ? (
            <span className="text-amber-400">⏳ Checking services…</span>
          ) : allOnline ? (
            <span className="text-emerald-400">✓ All systems operational</span>
          ) : (
            <span className="text-red-400">⚠ Some services are down</span>
          )}
        </div>

        {/* Service Status Cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          <ServiceStatusCard
            name="Backend API"
            description="Node.js + Express — handles authentication, GitHub integration, and serves the REST API."
            status={backendStatus}
            responseData={backendData}
          />
          <ServiceStatusCard
            name="AI Service"
            description="Python + FastAPI — handles code parsing, embeddings, and RAG-powered queries."
            status={aiStatus}
            responseData={aiData}
          />
        </div>

        {/* Architecture Info */}
        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Architecture
          </h2>
          <div className="grid gap-4 text-sm text-zinc-400 sm:grid-cols-3">
            <div className="rounded-lg bg-white/[0.03] p-4">
              <div className="mb-1 font-medium text-white">Frontend</div>
              <div>React + TypeScript + Vite + Tailwind</div>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                :5173
              </div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-4">
              <div className="mb-1 font-medium text-white">Backend</div>
              <div>Node.js + Express</div>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                :3001
              </div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-4">
              <div className="mb-1 font-medium text-white">AI Service</div>
              <div>Python + FastAPI</div>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                :8000
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-zinc-600">
          Sourcefinch · Phase 1 · Project Setup
        </footer>
      </div>
    </div>
  );
}
