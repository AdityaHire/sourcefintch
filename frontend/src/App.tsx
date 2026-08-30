import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import CinematicLandingHero from './components/CinematicLandingHero';
import LandingPageContent from './components/LandingPageContent';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ShaderBackground } from '@/components/ui/waves-shader';
import { ValleyOfTheMindShader } from '@/components/ui/valley-of-the-mind';
import { checkBackendHealth, checkAIServiceHealth } from './services/api';
import type { HealthResponse } from './types';

export default function App() {
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [backendHealth, setBackendHealth] = useState<'online' | 'unreachable' | 'checking'>('checking');
  const [aiHealth, setAiHealth] = useState<'online' | 'unreachable' | 'checking'>('checking');
  const [backendDetails, setBackendDetails] = useState<HealthResponse | null>(null);
  const [aiDetails, setAiDetails] = useState<HealthResponse | null>(null);

  // Theme support: default to 'light'
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

  // Determine current active view based on URL pathname & params
  const [activeTab, setActiveTab] = useState<'workspace' | 'landing'>(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path.startsWith('/workspace') || params.has('conversationId')) {
      return 'workspace';
    }
    return path === '/' && !params.has('conversationId') ? 'landing' : 'workspace';
  });

  // Handle URL history sync and popstate
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

  // Poll service health periodically
  useEffect(() => {
    let isMounted = true;
    const runHealthCheck = async () => {
      try {
        const b = await checkBackendHealth();
        if (isMounted) {
          setBackendHealth('online');
          setBackendDetails(b);
        }
      } catch {
        if (isMounted) setBackendHealth('unreachable');
      }

      try {
        const a = await checkAIServiceHealth();
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
  }, []);

  const allServicesHealthy = backendHealth === 'online' && aiHealth === 'online';

  // Shared Navbar Component
  const Navbar = ({ isWorkspace = false }: { isWorkspace?: boolean }) => (
    <nav
      className={`h-16 w-full shrink-0 flex items-center justify-between px-6 sm:px-12 z-40 transition-colors backdrop-blur-md ${
        isWorkspace
          ? 'border-b border-zinc-200/80 dark:border-zinc-800/60 bg-white/60 dark:bg-[#0a0a0c]/60'
          : 'bg-transparent border-none'
      }`}
    >
      {/* Brand Logo */}
      <button
        type="button"
        onClick={() => navigateTo('landing')}
        className="flex items-center gap-2.5 group cursor-pointer text-left"
        title="Sourcefinch"
      >
        {/* Emerald Teal Logo Icon with White Lightning */}
        <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
          Sourcefinch
        </span>
      </button>

      {/* Navigation items */}
      <div className="flex items-center gap-6 sm:gap-8 text-[13.5px] font-sans-ui">
        <button
          type="button"
          onClick={() => navigateTo('landing')}
          className={`transition-colors cursor-pointer py-1 ${
            activeTab === 'landing'
              ? 'text-zinc-900 dark:text-white font-semibold border-b-2 border-zinc-900 dark:border-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => navigateTo('workspace')}
          className={`transition-colors cursor-pointer py-1 ${
            activeTab === 'workspace'
              ? 'text-zinc-900 dark:text-white font-semibold border-b-2 border-zinc-900 dark:border-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium'
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

        {/* Animated ThemeToggle */}
        <ThemeToggle
          isDark={theme === 'dark'}
          onToggle={(isDark) => setTheme(isDark ? 'dark' : 'light')}
        />
      </div>
    </nav>
  );

  return (
    <div className="h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans-ui selection:bg-indigo-500/20 dark:selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-white flex flex-col overflow-hidden">
      {/* ── VIEW SWITCHER: WORKSPACE vs FULLSCREEN SEAMLESS LANDING ────── */}
      {activeTab === 'workspace' ? (
        /* ── Fullscreen IDE Workspace View with Valley of the Mind Shader ── */
        <div className="relative h-screen w-full flex flex-col overflow-hidden bg-gradient-to-br from-zinc-50/90 via-white/80 to-zinc-100/70 dark:from-[#09090b] dark:via-[#0c0c0e] dark:to-[#0a0a0d]">
          {/* Continuous Valley of the Mind animated shader across entire workspace */}
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
        /* ── Seamless Full-Viewport Landing Page ─────────────────────────── */
        <div className="relative h-screen w-full flex flex-col overflow-y-auto bg-white dark:bg-zinc-950">
          {/* Waves Shader Layer spanning the entire window from (0,0) */}
          <div className="fixed inset-0 z-0 pointer-events-none opacity-25 dark:opacity-40 overflow-hidden">
            <ShaderBackground className="h-full w-full" />
          </div>

          {/* Soft ambient gradient overlay spanning full viewport */}
          <div className="fixed inset-0 z-0 pointer-events-none bg-radial from-transparent via-white/40 to-white/90 dark:via-zinc-950/40 dark:to-zinc-950/90" />

          {/* Header directly on top of the continuous shader */}
          <div className="relative z-30 w-full">
            <Navbar isWorkspace={false} />
          </div>

          {/* Cinematic Animated Hero Content */}
          <CinematicLandingHero onExplore={() => navigateTo('workspace')} />

          {/* Antigravity & NotebookLM Inspired Scrollable Showcase & Footer */}
          <LandingPageContent
            onExplore={() => navigateTo('workspace')}
            onOpenDocs={() => setIsDocsOpen(true)}
          />
        </div>
      )}

      {/* ── MODAL: SYSTEM HEALTH ─────────────────────────────────────────── */}
      {isHealthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in font-sans-ui">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    allServicesHealthy ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">System Services Status</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHealthOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Backend API</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-code uppercase tracking-wider ${
                      backendHealth === 'online'
                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400'
                    }`}
                  >
                    {backendHealth}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 font-sans-ui">
                  Node.js + Express (:3001) — REST API, MySQL migrations, and GitHub repository ingestion.
                </p>
                {backendDetails && (
                  <pre className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-[10px] font-code text-zinc-700 dark:text-zinc-400 overflow-x-auto">
                    {JSON.stringify(backendDetails, null, 2)}
                  </pre>
                )}
              </div>

              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">AI Service</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-code uppercase tracking-wider ${
                      aiHealth === 'online'
                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400'
                    }`}
                  >
                    {aiHealth}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 font-sans-ui">
                  Python + FastAPI (:8000) — AST chunking, embeddings, Qdrant vector retrieval, and LLM RAG engine.
                </p>
                {aiDetails && (
                  <pre className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-[10px] font-code text-zinc-700 dark:text-zinc-400 overflow-x-auto">
                    {JSON.stringify(aiDetails, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHealthOpen(false)}
                className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DOCUMENTATION ─────────────────────────────────────────── */}
      {isDocsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in font-sans-ui">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Sourcefinch</span>
                <span className="text-zinc-400">· Guide</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDocsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans-ui">
              <section>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">1. Connect a Repository</h4>
                <p>
                  Click <strong>+ Add Repo</strong> in the left sidebar. Paste any public GitHub repository URL (e.g. <code>https://github.com/expressjs/express</code>) and optionally specify a branch.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">2. Ingestion & Embedding</h4>
                <p>
                  Sourcefinch clones the repo shallowly, parses code files into semantic AST chunks, embeds them into high-dimensional vectors, and indexes them in Qdrant.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">3. Natural Language Q&A</h4>
                <p>
                  Select the repository in the sidebar and type any question into the chat prompt. The AI service performs dense vector search to retrieve relevant code snippets, synthesizes an answer, and attaches line-level citations.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">4. Line Permalinks & Inspection</h4>
                <p>
                  Click any citation badge to view the exact code snippet in the right panel or click <strong>GitHub</strong> to jump directly to the permalink on GitHub.
                </p>
              </section>
            </div>

            <div className="mt-6 flex justify-end border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setIsDocsOpen(false)}
                className="rounded-lg bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
