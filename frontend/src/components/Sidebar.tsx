"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Repository } from '../types';
import { useApiClient } from '../services/useApiClient';
import { StatusDot } from './ui/StatusDot';
import { Modal } from './ui/Modal';
import { RepoIngestionLoader } from '@/components/ui/repo-ingestion-loader';
import {
  Plus,
  Trash2,
  FolderGit2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  repositories: Repository[];
  selectedRepoId: number | null;
  onSelectRepo: (repoId: number) => void;
  isLoading: boolean;
  onRepoAdded: (newRepo: Repository) => void;
  onRepoDeleted?: (deletedRepoId: number) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  repositories,
  selectedRepoId,
  onSelectRepo,
  isLoading,
  onRepoAdded,
  onRepoDeleted,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const api = useApiClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete repository state
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deduplicate repositories by ID to prevent duplicate items in sidebar
  const uniqueRepos = useMemo(() => {
    const map = new Map<number, Repository>();
    repositories.forEach((r) => {
      if (!map.has(r.id)) {
        map.set(r.id, r);
      }
    });
    return Array.from(map.values());
  }, [repositories]);

  const filteredRepos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return uniqueRepos;
    return uniqueRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.owner.toLowerCase().includes(query)
    );
  }, [uniqueRepos, searchQuery]);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setIndexingStatus('Initiating ingestion pipeline...');

    try {
      const initResult = await api.createRepository(githubUrl.trim(), branch.trim() || undefined);
      const repoId = initResult.id;
      setIndexingStatus(`Indexing started (ID: ${repoId}). Ingesting & embedding code chunks...`);

      // Poll until completed or failed (up to 45s)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const repo = await api.getRepository(repoId);
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

  const handleConfirmDelete = async () => {
    if (!repoToDelete || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteRepository(repoToDelete.id);
      if (onRepoDeleted) {
        onRepoDeleted(repoToDelete.id);
      }
      setRepoToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to remove repository');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* ── Desktop Animated Collapsible Sidebar ──────────────────────── */}
      <motion.aside
        animate={{ width: isCollapsed ? 64 : 290 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className={`relative hidden md:flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md z-20 shrink-0 select-none overflow-hidden h-full`}
      >
        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/60 px-3 py-3 bg-white/40 dark:bg-transparent min-h-[49px]">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 overflow-hidden whitespace-nowrap"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans-ui">
                  Repositories
                </span>
                <span className="font-code text-[11px] rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.2 text-zinc-600 dark:text-zinc-400 font-medium">
                  {uniqueRepos.length}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Add Repo Button */}
            {!isCollapsed ? (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-2.5 py-1 text-[11.5px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-xs font-sans-ui whitespace-nowrap"
                title="Add a new GitHub repository"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Repo</span>
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-xs"
                title="Add GitHub repository"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Minimal Collapse / Expand Slider Toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-all cursor-pointer shrink-0"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* ── Search Input (Expanded only) ──────────────────────────── */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 border-b border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-700 focus:outline-none transition-all font-sans-ui shadow-2xs"
                />
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Repository List ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-zinc-500 font-sans-ui animate-subtle-pulse">
              {!isCollapsed && 'Loading repositories...'}
            </div>
          ) : filteredRepos.length === 0 ? (
            !isCollapsed && (
              <div className="p-4 text-center">
                <p className="text-xs text-zinc-500 font-sans-ui">
                  {searchQuery ? 'No matching repositories.' : 'No repositories yet.'}
                </p>
              </div>
            )
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = repo.id === selectedRepoId;

              if (isCollapsed) {
                // Collapsed icon-only rail item with tooltip
                return (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => onSelectRepo(repo.id)}
                    className={`relative w-full p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xs'
                        : 'border border-transparent hover:bg-white/80 dark:hover:bg-zinc-900/50 hover:border-zinc-200/60 dark:hover:border-zinc-800/80 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                    title={`${repo.name} (${repo.branch || 'main'})`}
                  >
                    <FolderGit2
                      className={`w-4 h-4 ${
                        isSelected
                          ? 'text-zinc-900 dark:text-white'
                          : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white'
                      }`}
                    />
                    {isSelected && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300" />
                    )}
                  </button>
                );
              }

              // Expanded full repository card
              return (
                <div
                  key={repo.id}
                  onClick={() => onSelectRepo(repo.id)}
                  className={`group relative w-full text-left rounded-xl p-3 transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xs ring-1 ring-zinc-400/20 dark:ring-zinc-600/20'
                      : 'border border-transparent hover:bg-white/80 dark:hover:bg-zinc-900/50 hover:border-zinc-200/60 dark:hover:border-zinc-800/80'
                  }`}
                >
                  {/* Top row: Dominant Repository Name + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[13px] font-semibold truncate tracking-tight font-sans-ui ${
                        isSelected
                          ? 'text-zinc-900 dark:text-white'
                          : 'text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white'
                      }`}
                    >
                      {repo.owner ? `${repo.owner} / ${repo.name}` : repo.name}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Delete button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRepoToDelete(repo);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-all cursor-pointer"
                        title={`Remove ${repo.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Subline: Branch, File Count & Subtle Ready Status */}
                  <div className="flex items-center justify-between text-[11.5px] text-zinc-500 dark:text-zinc-400 font-sans-ui">
                    <div className="flex items-center gap-1.5 font-code">
                      <span className="truncate">{repo.branch || 'main'}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span>{repo.file_count || 0} files</span>
                    </div>

                    <StatusDot
                      status={repo.status === 'completed' ? 'online' : 'muted'}
                      label={repo.status === 'completed' ? 'Ready' : (repo.status || 'Pending')}
                      className="text-[11px]"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.aside>

      {/* ── Mobile Sidebar Drawer ─────────────────────────────────────── */}
      <AnimatePresence>
        {isOpenMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 w-80 shadow-2xl bg-white dark:bg-zinc-950 z-40 md:hidden flex flex-col border-r border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Repositories
                  </span>
                  <span className="font-code text-xs rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-600 dark:text-zinc-300">
                    {uniqueRepos.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-2.5 py-1 text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Repo</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="p-3 border-b border-zinc-200/60 dark:border-zinc-800/50">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                  />
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                </div>
              </div>

              {/* Mobile Repo List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => {
                      onSelectRepo(repo.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full rounded-xl p-3 text-left border ${
                      repo.id === selectedRepoId
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                      {repo.name}
                    </div>
                    <div className="text-xs text-zinc-500 font-code mt-1">
                      {repo.branch || 'main'} · {repo.file_count || 0} files
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Add Repository Modal ──────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        size="md"
      >
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add GitHub Repository</h3>
        </div>

        <form onSubmit={handleAddRepo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 font-sans-ui">
              GitHub Repository URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="https://github.com/owner/repository"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400/40 font-sans-ui transition-colors duration-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 font-sans-ui">
              Branch <span className="text-zinc-400 font-normal">(optional, default: default branch)</span>
            </label>
            <input
              type="text"
              placeholder="main, master, etc."
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400/40 font-sans-ui transition-colors duration-100"
            />
          </div>

          {errorMessage && (
            <div className="rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 font-sans-ui">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 font-sans-ui"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !githubUrl.trim()}
              className="rounded-[var(--radius-sm)] bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs disabled:opacity-40 font-sans-ui"
            >
              {isSubmitting ? 'Submitting...' : 'Ingest Repository'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      <Modal
        open={!!repoToDelete}
        onClose={() => !isDeleting && setRepoToDelete(null)}
        size="sm"
        title={
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-7 h-7 rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-3.5 h-3.5" />
            </span>
            Remove Repository
          </span>
        }
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          This action cannot be undone.
        </p>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 mb-4 leading-relaxed">
          Are you sure you want to remove{' '}
          <span className="font-semibold text-zinc-900 dark:text-white">
            {repoToDelete?.name}
          </span>
          ? All indexed chunks and metadata will be permanently deleted.
        </p>

        {deleteError && (
          <div className="rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-400 mb-4">
            {deleteError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => !isDeleting && setRepoToDelete(null)}
            disabled={isDeleting}
            className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 font-sans-ui"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="rounded-[var(--radius-sm)] bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-xs disabled:opacity-40 font-sans-ui"
          >
            {isDeleting ? 'Removing...' : 'Delete Repository'}
          </button>
        </div>
      </Modal>

      {/* ── Fullscreen Ingestion Modal (GSAP Smooth Progress) ─────────── */}
      {isSubmitting && (
        <RepoIngestionLoader
          repoName={githubUrl}
          statusText={indexingStatus || undefined}
        />
      )}
    </>
  );
}
