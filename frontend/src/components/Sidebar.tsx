import { useState } from 'react';
import type { Repository } from '../types';
import { createRepository, getRepository } from '../services/api';

interface SidebarProps {
  repositories: Repository[];
  selectedRepoId: number | null;
  onSelectRepo: (repoId: number) => void;
  isLoading: boolean;
  onRepoAdded: (newRepo: Repository) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  repositories,
  selectedRepoId,
  onSelectRepo,
  isLoading,
  onRepoAdded,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setIndexingStatus('Initiating ingestion pipeline...');

    try {
      const initResult = await createRepository(githubUrl.trim(), branch.trim() || undefined);
      const repoId = initResult.id;
      setIndexingStatus(`Indexing started (ID: ${repoId}). Ingesting & embedding code chunks...`);

      // Poll until completed or failed (up to 45s)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const repo = await getRepository(repoId);
          setIndexingStatus(`Current status: ${repo.status} (${repo.file_count || 0} files)`);

          if (repo.status === 'completed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setIsModalOpen(false);
            setGithubUrl('');
            setBranch('');
            setIndexingStatus(null);
            onRepoAdded(repo);
            onSelectRepo(repo.id);
          } else if (repo.status === 'failed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setErrorMessage('Repository indexing failed.');
          } else if (attempts >= 45) {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setErrorMessage('Indexing timed out. Please check repository list later.');
          }
        } catch {
          // Ignore transient poll errors
        }
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      setIndexingStatus(null);
      setErrorMessage(err.message || 'Failed to submit repository for ingestion');
    }
  };

  return (
    <>
      <aside
        className={`flex flex-col border-r border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl transition-all duration-300 z-20 shrink-0 ${
          isOpenMobile
            ? 'fixed inset-y-0 left-0 w-80 shadow-2xl block'
            : 'hidden md:flex md:w-72 lg:w-80'
        }`}
      >
        {/* Header with Add Repo button */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Repositories ({repositories.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all cursor-pointer"
              title="Add a new GitHub repository"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Repo</span>
            </button>
            {isOpenMobile && onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden text-zinc-400 hover:text-white p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3 py-1.5 pl-8 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Repository List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-zinc-500 animate-pulse">
              Loading repositories...
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              {searchQuery ? 'No repositories match your search.' : 'No completed repositories found.'}
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = repo.id === selectedRepoId;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => {
                    onSelectRepo(repo.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full text-left rounded-xl p-3 transition-all cursor-pointer group flex flex-col gap-1.5 border ${
                    isSelected
                      ? 'border-indigo-500/50 bg-indigo-600/15 shadow-sm shadow-indigo-500/10'
                      : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-200' : 'text-zinc-200 group-hover:text-white'}`}>
                      {repo.owner}/{repo.name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Ready
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                      <svg className="h-3 w-3 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      {repo.branch || 'main'}
                    </span>
                    <span>·</span>
                    <span>{repo.file_count} files</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Add Repository Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add GitHub Repository
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsModalOpen(false);
                    setErrorMessage(null);
                    setIndexingStatus(null);
                  }
                }}
                disabled={isSubmitting}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRepo} className="space-y-4">
              <div>
                <label htmlFor="repo-url" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  GitHub Repository URL:
                </label>
                <input
                  id="repo-url"
                  type="url"
                  required
                  placeholder="https://github.com/owner/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="repo-branch" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Branch (Optional, defaults to default branch):
                </label>
                <input
                  id="repo-branch"
                  type="text"
                  placeholder="e.g. main or master"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {indexingStatus && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300 flex items-center gap-2.5">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                  <span>{indexingStatus}</span>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-white/[0.1] bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!githubUrl.trim() || isSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <span>Ingest Repository</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
