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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import CinematicLandingHero from '../components/CinematicLandingHero';
import LandingPageContent from '../components/LandingPageContent';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ShaderBackground } from '@/components/ui/waves-shader';

export default function LandingPage() {
  // Hooks MUST be called unconditionally at the top — no early returns
  // before useAuth() or useState() to avoid React hook-order crashes.
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sf_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sf_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const goToWorkspace = () => navigate('/workspace');

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans-ui">
      {/* ── Public Navbar (always visible, adapts to auth state) ─────────── */}
      <nav className="h-16 w-full shrink-0 flex items-center justify-between px-6 sm:px-12 z-40 bg-transparent">
        <div className="flex items-center gap-2.5" title="Sourcefinch">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
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
        <ShaderBackground className="h-full w-full" />
      </div>
      <div className="fixed inset-0 z-0 pointer-events-none bg-radial from-transparent via-white/40 to-white/90 dark:via-zinc-950/40 dark:to-zinc-950/90" />

      <div className="relative z-10 flex-1 flex flex-col">
        <CinematicLandingHero onExplore={goToWorkspace} />
        <LandingPageContent
          onExplore={goToWorkspace}
          onOpenDocs={() => setIsDocsOpen(true)}
        />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-200/60 dark:border-zinc-800/60 py-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
        Sourcefinch · AI-powered codebase intelligence
      </footer>

      {/* Docs modal placeholder — reuse the same shell from WorkspacePage if needed */}
      {isDocsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Sourcefinch · Guide
              </h3>
              <button
                type="button"
                onClick={() => setIsDocsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Sign in to connect a repository and start asking questions about your code.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDocsOpen(false)}
                className="rounded-lg bg-black dark:bg-white text-white dark:text-black px-4 py-1.5 text-xs font-semibold"
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