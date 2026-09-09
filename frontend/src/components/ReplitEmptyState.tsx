import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useUser } from '@clerk/clerk-react';
import { FolderGit2, Clock, Sparkles, ArrowRight } from 'lucide-react';
import type { Repository } from '../types';

interface ReplitEmptyStateProps {
  repositories: Repository[];
  isLoadingRepos: boolean;
  activeRepo: Repository | null;
  selectedRepoId: number | null;
  isSubmitting: boolean;
  starterPrompts: { label: string; icon: React.ComponentType<{ className?: string }>; query: string }[];
  onSendMessage: (text: string) => void;
  onSelectRepo: (repoId: number) => void;
}

export function ReplitEmptyState({
  repositories,
  isLoadingRepos,
  activeRepo,
  selectedRepoId,
  isSubmitting,
  starterPrompts,
  onSendMessage,
  onSelectRepo,
}: ReplitEmptyStateProps) {
  const { user } = useUser();
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const displayName = user?.firstName || user?.username || 'there';

  const recentRepos = repositories.slice(0, 3);

  return (
    <div className="flex h-full flex-col items-center justify-start pt-1 sm:pt-2 max-w-4xl mx-auto px-4 select-none">
      {/* ── Recent Projects ─────────────────────────────────────────── */}
      {(recentRepos.length > 0 || isLoadingRepos) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-4xl mb-8 sm:mb-10 md:mb-12"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 font-sans-ui">
            Recent projects
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {isLoadingRepos
              ? [1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-[56px] rounded-md border border-zinc-200/70 dark:border-white/[0.07] bg-zinc-100/70 dark:bg-white/[0.03] animate-pulse"
                  />
                ))
              : recentRepos.map((repo) => {
                  const isSelected = selectedRepoId === repo.id;
                  return (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => onSelectRepo(repo.id)}
                      className={`group text-left rounded-md border p-2.5 sm:p-3 transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500/60 bg-indigo-50/40 dark:border-indigo-400/40 dark:bg-indigo-950/20 shadow-xs'
                          : 'border-zinc-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.025] hover:border-zinc-300 dark:hover:border-white/[0.15] hover:bg-white dark:hover:bg-white/[0.05] shadow-2xs'
                      }`}
                    >
                      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-200 truncate font-sans-ui mb-1.5">
                        {repo.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-500 dark:text-zinc-500 font-code">
                        <FolderGit2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="truncate">{repo.owner}</span>
                        <span>·</span>
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{repo.branch || 'main'}</span>
                      </div>
                    </button>
                  );
                })}
          </div>
        </motion.div>
      )}

      {/* ── Personalized Greeting ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-8 max-w-4xl w-full"
      >
        <h1 className="text-xl sm:text-2xl md:text-[32px] lg:text-[38px] sm:whitespace-nowrap font-bold tracking-tight text-zinc-900 dark:text-white font-sans-ui leading-tight">
          {activeRepo
            ? `What would you like to explore in ${activeRepo.name}?`
            : `${displayName}, what are we working on today?`}
        </h1>
        {activeRepo && (
          <p className="text-xs sm:text-[13px] text-zinc-500 dark:text-zinc-400 font-sans-ui mt-2">
            Currently exploring{' '}
            <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{activeRepo.name}</span>
          </p>
        )}
      </motion.div>

      {/* ── Suggested Prompts ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 w-full max-w-xl"
      >
        <div className="flex items-center gap-1.5 mb-2.5 px-1">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-sans-ui">
            Suggested for you
          </span>
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        </div>
        <div className="flex flex-col gap-2">
          {starterPrompts.slice(0, showAllPrompts ? starterPrompts.length : 3).map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(item.query)}
                disabled={!selectedRepoId || isSubmitting}
                className="group flex items-center gap-2.5 rounded-md border border-zinc-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.025] px-3 py-2.5 text-left text-[12px] text-zinc-700 dark:text-zinc-300 hover:border-indigo-400/60 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all cursor-pointer font-sans-ui disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 shadow-2xs"
              >
                <div className="w-6.5 h-6.5 rounded-sm bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
                  <Icon className="w-3 h-3 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
                <span className="font-medium truncate">{item.label}</span>
                <ArrowRight className="ml-auto w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 group-hover:translate-x-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all" />
              </button>
            );
          })}
        </div>
        {starterPrompts.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAllPrompts((current) => !current)}
            className="mt-2.5 rounded-md px-2 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 cursor-pointer"
          >
            {showAllPrompts
              ? 'Show fewer suggestions'
              : `More suggestions (${starterPrompts.length - 3})`}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default ReplitEmptyState;
