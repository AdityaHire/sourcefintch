import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [activeView, setActiveView] = useState<'workspace' | 'health'>('workspace');

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-white selection:bg-indigo-500/30">
      {/* Background ambient gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-[128px]" />
        <div className="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-violet-600/10 blur-[128px]" />
      </div>

      {/* Compact Top Header */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-zinc-900/60 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-black text-xs shadow-md shadow-indigo-500/20">
            SF
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm bg-gradient-to-r from-indigo-200 via-violet-200 to-purple-200 bg-clip-text text-transparent">
              Sourcefinch
            </span>
            <span className="text-[10px] font-mono rounded bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.2 text-zinc-400">
              Workspace
            </span>
          </div>
        </div>

        {/* View Switcher / System Health */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('workspace')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              activeView === 'workspace'
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.1]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('health')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              activeView === 'health'
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.1]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
            title="Inspect backend & AI service status"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Health</span>
          </button>
        </div>
      </header>

      {/* Main Workspace View */}
      <main className="relative z-10 flex-1 overflow-hidden">
        {activeView === 'workspace' ? (
          <ChatInterface />
        ) : (
          <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto">
            <Dashboard />
          </div>
        )}
      </main>
    </div>
  );
}


