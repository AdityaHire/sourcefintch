/**
 * WorkspacePage — authenticated landing after sign-in.
 *
 * Wraps the original App shell (landing hero + chat workspace) but is only
 * reachable by signed-in users (ProtectedRoute).  Signed-out users hitting
 * "/" are redirected to /sign-in.
 */

import { useEffect, useState } from 'react';
import ChatInterface from '../components/ChatInterface';
import CinematicLandingHero from '../components/CinematicLandingHero';
import LandingPageContent from '../components/LandingPageContent';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ShaderBackground } from '@/components/ui/waves-shader';
import { ValleyOfTheMindShader } from '@/components/ui/valley-of-the-mind';
import { Modal } from '../components/ui/Modal';
import { StatusDot } from '../components/ui/StatusDot';
import { UserButton } from '@clerk/clerk-react';
import { useApiClient } from '../services/useApiClient';
import type { HealthResponse } from '../types';

export default function WorkspacePage() {
  const api = useApiClient();
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [backendHealth, setBackendHealth] = useState<'online' | 'unreachable' | 'checking'>('checking');
  const [aiHealth, setAiHealth] = useState<'online' | 'unreachable' | 'checking'>('checking');
  const [backendDetails, setBackendDetails] = useState<HealthResponse | null>(null);
  const [aiDetails, setAiDetails] = useState<HealthResponse | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sf_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('sf_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'workspace' | 'landing'>(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path.startsWith('/workspace') || params.has('conversationId')) {
      return 'workspace';
    }
    return 'landing';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path.startsWith('/workspace') || params.has('conversationId')) {
        setActiveTab('workspace');
      } else {
        setActiveTab('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (tab: 'workspace' | 'landing') => {
    setActiveTab(tab);
    const search = window.location.search;
    if (tab === 'workspace') {
      window.history.pushState(null, '', '/workspace' + search);
    } else {
      window.history.pushState(null, '', '/' + search);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const runHealthCheck = async () => {
      try {
        const b = await api.checkBackendHealth();
        if (isMounted) {
          setBackendHealth('online');
          setBackendDetails(b);
        }
      } catch {
        if (isMounted) setBackendHealth('unreachable');
      }
      try {
        const a = await api.checkAIServiceHealth();
        if (isMounted) {
          setAiHealth('online');
          setAiDetails(a);
        }
      } catch {
        if (isMounted) setAiHealth('unreachable');
      }
    };
    runHealthCheck();
    const interval = setInterval(runHealthCheck, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [api]);

  const allServicesHealthy = backendHealth === 'online' && aiHealth === 'online';

  const Navbar = ({ isWorkspace = false }: { isWorkspace?: boolean }) => (
    <nav
      className={`h-16 w-full shrink-0 flex items-center justify-between px-6 sm:px-12 z-40 transition-colors backdrop-blur-md ${
        isWorkspace
          ? 'border-b border-zinc-200/80 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/60'
          : 'bg-transparent border-none'
      }`}
    >
      <button
        type="button"
        onClick={() => navigateTo('landing')}
        className="flex items-center gap-2.5 group cursor-pointer text-left"
        title="Sourcefinch"
      >
        <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
          Sourcefinch
        </span>
      </button>

      <div className="flex items-center gap-6 sm:gap-8 text-[13.5px] font-sans-ui">
        <button
          type="button"
          onClick={() => navigateTo('landing')}
          className={`transition-colors cursor-pointer py-1 border-b-2 ${
            activeTab === 'landing'
              ? 'text-zinc-900 dark:text-white font-semibold border-zinc-900 dark:border-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold border-transparent'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => navigateTo('workspace')}
          className={`transition-colors cursor-pointer py-1 border-b-2 ${
            activeTab === 'workspace'
              ? 'text-zinc-900 dark:text-white font-semibold border-zinc-900 dark:border-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold border-transparent'
          }`}
        >
          Workspace
        </button>

        <button
          type="button"
          onClick={() => setIsDocsOpen(true)}
          className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer font-medium"
        >
          Docs
        </button>

        <ThemeToggle
          isDark={theme === 'dark'}
          onToggle={(isDark) => setTheme(isDark ? 'dark' : 'light')}
        />

        <UserButton afterSignOutUrl="/" />
      </div>
    </nav>
  );

  return (
    <div className="h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans-ui selection:bg-indigo-500/20 dark:selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-white flex flex-col overflow-hidden">
      {activeTab === 'workspace' ? (
        <div className="relative h-screen w-full flex flex-col overflow-hidden bg-gradient-to-br from-zinc-50/90 via-white/80 to-zinc-100/70 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
          <div className="fixed inset-0 z-0 pointer-events-none opacity-40 dark:opacity-30 overflow-hidden">
            <ValleyOfTheMindShader className="h-full w-full" />
          </div>
          <div className="relative z-10 w-full">
            <Navbar isWorkspace={true} />
          </div>
          <main className="relative z-10 flex-1 w-full h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <ChatInterface />
          </main>
        </div>
      ) : (
        <div className="relative h-screen w-full flex flex-col overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="fixed inset-0 z-0 pointer-events-none opacity-25 dark:opacity-40 overflow-hidden">
            <ShaderBackground className="h-full w-full" />
          </div>
          <div className="fixed inset-0 z-0 pointer-events-none bg-radial from-transparent via-white/40 to-white/90 dark:via-zinc-950/40 dark:to-zinc-950/90" />
          <div className="relative z-30 w-full">
            <Navbar isWorkspace={false} />
          </div>
          <CinematicLandingHero onExplore={() => navigateTo('workspace')} />
          <LandingPageContent
            onExplore={() => navigateTo('workspace')}
            onOpenDocs={() => setIsDocsOpen(true)}
          />
        </div>
      )}

      <Modal open={isHealthOpen} onClose={() => setIsHealthOpen(false)} size="lg" title="System Services Status">
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <StatusDot
            status={allServicesHealthy ? 'online' : 'checking'}
            label={allServicesHealthy ? 'All services operational' : 'Some services are down'}
          />
        </div>
        <div className="space-y-3.5">
          <div className="rounded-[var(--radius-md)] border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Backend API</span>
              <StatusDot
                status={backendHealth === 'online' ? 'online' : backendHealth === 'checking' ? 'checking' : 'failed'}
                label={backendHealth}
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 font-sans-ui">
              Node.js + Express (:3001) — REST API, MySQL migrations, and GitHub repository ingestion.
            </p>
            {backendDetails && (
              <pre className="rounded-[var(--radius-sm)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-[10px] font-code text-zinc-700 dark:text-zinc-400 overflow-x-auto">
                {JSON.stringify(backendDetails, null, 2)}
              </pre>
            )}
          </div>
          <div className="rounded-[var(--radius-md)] border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">AI Service</span>
              <StatusDot
                status={aiHealth === 'online' ? 'online' : aiHealth === 'checking' ? 'checking' : 'failed'}
                label={aiHealth}
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 font-sans-ui">
              Python + FastAPI (:8000) — AST chunking, embeddings, Qdrant vector retrieval, and LLM RAG engine.
            </p>
            {aiDetails && (
              <pre className="rounded-[var(--radius-sm)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-[10px] font-code text-zinc-700 dark:text-zinc-400 overflow-x-auto">
                {JSON.stringify(aiDetails, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <span>Sourcefinch</span>
            <span className="text-zinc-400 font-normal">· Guide</span>
          </span>
        }
      >
        <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans-ui">
          <section>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">1. Connect a Repository</h4>
            <p>
              Click <strong>+ Add Repo</strong> in the left sidebar. Paste any public GitHub repository URL and optionally specify a branch.
            </p>
          </section>
          <section>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">2. Ingestion & Embedding</h4>
            <p>
              Sourcefinch clones the repo shallowly, parses code files into semantic AST chunks, embeds them, and indexes them in Qdrant.
            </p>
          </section>
          <section>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">3. Natural Language Q&amp;A</h4>
            <p>
              Select the repository in the sidebar and type any question into the chat prompt. The AI service performs dense vector search and attaches line-level citations.
            </p>
          </section>
        </div>
      </Modal>
    </div>
  );
}