/**
 * WorkspacePage — authenticated shell for the chat workspace.
 *
 * No top navbar.  The Sidebar (mounted by ChatInterface) now owns the
 * brand, top nav, theme toggle, user menu, and health indicator.
 *
 * This page owns:
 *   - Theme state (synced to localStorage + the .dark class)
 *   - Active tab state (workspace vs. landing)
 *   - The Docs modal and System Services modal (anchored at the page
 *     level so they survive Sidebar re-renders)
 */

import { useEffect, useState } from 'react';
import ChatInterface from '../components/ChatInterface';
import CinematicLandingHero from '../components/CinematicLandingHero';
import LandingPageContent from '../components/LandingPageContent';
import { ShaderBackground } from '@/components/ui/waves-shader';
import { ValleyOfTheMindShader } from '@/components/ui/valley-of-the-mind';
import { Modal } from '../components/ui/Modal';

export default function WorkspacePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sf_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'landing'>('workspace');

  useEffect(() => {
    localStorage.setItem('sf_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const navigateTo = (tab: 'workspace' | 'landing') => {
    setActiveTab(tab);
    const search = window.location.search;
    if (tab === 'workspace') {
      window.history.pushState(null, '', '/workspace' + search);
    } else {
      window.history.pushState(null, '', '/' + search);
    }
  };

  // ── Overview / Landing view (no sidebar) ──────────────────────────────
  if (activeTab === 'landing') {
    return (
      <div className="h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans-ui selection:bg-indigo-500/20 dark:selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-white flex flex-col overflow-hidden">
        <div className="relative h-screen w-full flex flex-col overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="fixed inset-0 z-0 pointer-events-none opacity-25 dark:opacity-40 overflow-hidden">
            <ShaderBackground className="h-full w-full" />
          </div>
          <div className="fixed inset-0 z-0 pointer-events-none bg-radial from-transparent via-white/40 to-white/90 dark:via-zinc-950/40 dark:to-zinc-950/90" />
          <div className="relative z-30 flex-1 w-full">
            <CinematicLandingHero onExplore={() => navigateTo('workspace')} />
            <LandingPageContent
              onExplore={() => navigateTo('workspace')}
              onOpenDocs={() => setIsDocsOpen(true)}
            />
          </div>
        </div>

        <DocsModal open={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
      </div>
    );
  }

  // ── Workspace view — full-height flex, NO top navbar ──────────────────
  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-zinc-50/90 via-white/80 to-zinc-100/70 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans-ui overflow-hidden">
      {/* Background shader sits behind everything. */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 dark:opacity-30 overflow-hidden">
        <ValleyOfTheMindShader className="h-full w-full" />
      </div>

      <main className="relative z-10 flex-1 h-full min-w-0 overflow-hidden flex flex-col">
        <ChatInterface
          activeTab={activeTab}
          onNavigateTo={navigateTo}
          onOpenDocs={() => setIsDocsOpen(true)}
          theme={theme}
          setTheme={setTheme}
        />
      </main>

      <DocsModal open={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}

// ── Docs modal (single source of truth for the in-app guide) ────────────

function DocsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
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
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-1">2. Ingestion &amp; Embedding</h4>
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
  );
}