/**
 * LandingPage — public cinematic landing shown at "/" for everyone.
 *
 * Signed-out users see "Sign in to continue" as the hero CTA.
 * Signed-in users see "Open Workspace" which navigates to /workspace.
 *
 * The shell (shader background, navbar, theme toggle) is identical to the
 * "Overview" tab inside the protected /workspace route — extracted so the
 * landing experience is consistent regardless of auth state.
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import CinematicLandingHero from '../components/CinematicLandingHero';
import LandingPageContent from '../components/LandingPageContent';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Modal } from '../components/ui/Modal';
import { useTheme } from '../contexts/ThemeContext';

const ShaderBackground = lazy(() =>
  import('@/components/ui/waves-shader').then((m) => ({ default: m.ShaderBackground }))
);

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  useEffect(() => {
    document.title = 'Sourcefinch — AI-Powered Codebase Intelligence';
  }, []);

  const goToWorkspace = () => navigate('/workspace');

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans-ui">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:m-2"
      >
        Skip to main content
      </a>

      {/* ── Public Navbar (always visible, adapts to auth state) ─────────── */}
      <nav aria-label="Main Navigation" className="h-16 w-full shrink-0 flex items-center justify-between px-6 sm:px-12 z-40 bg-transparent">
        <div className="flex items-center gap-2.5" title="Sourcefinch">
          <img src="/logo2.png" alt="" className="w-7 h-7 rounded-lg object-contain dark:hidden" />
          <img src="/logo.png" alt="" className="hidden w-7 h-7 rounded-lg object-contain dark:block" />
          <span className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
            Sourcefinch
          </span>
        </div>

        <div className="flex items-center gap-6 sm:gap-8 text-[13.5px] font-sans-ui">
          <button
            type="button"
            onClick={goToWorkspace}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer py-1 border-b-2 border-transparent font-semibold"
          >
            Workspace
          </button>
          <ThemeToggle
            isDark={theme === 'dark'}
            onToggle={(isDark) => setTheme(isDark ? 'dark' : 'light')}
          />
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <SignInButton mode="modal" forceRedirectUrl="/workspace">
              <button
                type="button"
                className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors cursor-pointer font-sans-ui"
              >
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </nav>

      {/* ── Shader background + ambient gradient ─────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25 dark:opacity-40 overflow-hidden">
        <Suspense fallback={null}>
          <ShaderBackground className="h-full w-full" />
        </Suspense>
      </div>
      <div className="fixed inset-0 z-0 pointer-events-none bg-radial from-transparent via-white/40 to-white/90 dark:via-zinc-950/40 dark:to-zinc-950/90" />

      <main id="main-content" className="relative z-10 flex-1 flex flex-col">
        <CinematicLandingHero onExplore={goToWorkspace} />
        <LandingPageContent
          onExplore={goToWorkspace}
          onOpenDocs={() => setIsDocsOpen(true)}
        />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-200/60 dark:border-zinc-800/60 py-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
        Sourcefinch · AI-powered codebase intelligence
      </footer>

      {/* Docs modal — uses shared Modal so the divider/title behaviour matches WorkspacePage */}
      <Modal
        open={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        size="lg"
        title="Sourcefinch · Guide"
      >
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Sign in to connect a repository and start asking questions about your code.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setIsDocsOpen(false)}
            className="rounded-[var(--radius-sm)] bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </Modal>
    </div>
  );
}