import { ArrowLeft, ArrowRight, BookOpen, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OfficialPageLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: 'docs' | 'privacy' | 'terms';
  singleLineTitle?: boolean;
  children: React.ReactNode;
}

const icons = {
  docs: BookOpen,
  privacy: ShieldCheck,
  terms: FileText,
};

export default function OfficialPageLayout({
  eyebrow,
  title,
  description,
  icon,
  singleLineTitle = false,
  children,
}: OfficialPageLayoutProps) {
  const Icon = icons[icon];

  return (
    <div className="min-h-screen bg-[#f7f6f4] text-zinc-900 dark:bg-[#090a0b] dark:text-zinc-100 font-sans-ui">
      <header className="border-b border-zinc-200/70 bg-white/75 dark:border-white/[0.08] dark:bg-[#0d0e10]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 rounded-md">
            <img src="/logo.png" alt="Sourcefinch" className="hidden h-8 w-8 rounded-lg object-contain dark:block" />
            <img src="/logo2.png" alt="Sourcefinch" className="h-8 w-8 rounded-lg object-contain dark:hidden" />
            <span>Sourcefinch</span>
          </Link>
          <Link to="/workspace" className="inline-flex items-center gap-1.5 rounded-[7px] bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50">
            Open Workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            <Icon className="h-4 w-4" />
            <span>{eyebrow}</span>
          </div>
          <h1 className={`${singleLineTitle ? 'whitespace-nowrap text-[clamp(1.1rem,6vw,3rem)]' : 'text-3xl sm:text-5xl'} font-semibold tracking-tight text-zinc-950 dark:text-white`}>{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 sm:text-base">{description}</p>
        </div>

        <article className="rounded-[10px] border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10">
          <div className="space-y-8 text-sm leading-7 text-zinc-700 dark:text-zinc-300">{children}</div>
        </article>

        <nav className="mt-8 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 rounded">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sourcefinch
          </Link>
          <Link to="/documentation" className="hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 rounded">Documentation</Link>
          <Link to="/privacy" className="hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 rounded">Privacy</Link>
          <Link to="/terms" className="hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 rounded">Terms</Link>
        </nav>
      </main>
    </div>
  );
}

export function OfficialSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-zinc-950 dark:text-white sm:text-lg">{title}</h2>
      {children}
    </section>
  );
}
