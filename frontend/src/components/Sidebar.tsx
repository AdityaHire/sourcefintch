"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Repository } from '../types';
import { useApiClient } from '../services/useApiClient';
import { StatusDot } from './ui/StatusDot';
import { Modal } from './ui/Modal';
import { RepoIngestionLoader } from '@/components/ui/repo-ingestion-loader';
import { UserButton, useUser, SignInButton } from '@clerk/clerk-react';
import {
  Plus,
  Trash2,
  FolderGit2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  MessageSquare,
  BookOpen,
} from 'lucide-react';

export type SidebarTab = 'workspace' | 'landing';

interface SidebarProps {
  repositories: Repository[];
  selectedRepoId: number | null;
  onSelectRepo: (repoId: number) => void;
  isLoading: boolean;
  onRepoAdded: (newRepo: Repository) => void;
  onRepoDeleted?: (deletedRepoId: number) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  /** Currently active workspace tab (drives the Overview/Workspace nav highlight). */
  activeTab: SidebarTab;
  onNavigateTo: (tab: SidebarTab) => void;
  onOpenDocs: () => void;
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
  activeTab,
  onNavigateTo,
  onOpenDocs,
}: SidebarProps) {
  const api = useApiClient();
  // ── Clerk session — for the user footer row (image + name + menu) ──
  // Hooks MUST be called unconditionally at the top; Clerk's useUser is safe
  // to call even when the user is signed out.
  const { isSignedIn, user, isLoaded: userLoaded } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const uniqueRepos = useMemo(() => repositories, [repositories]);

  const filteredRepos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueRepos;
    return uniqueRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        (r.github_url || '').toLowerCase().includes(q)
    );
  }, [uniqueRepos, searchQuery]);

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setIndexingStatus('Cloning repository…');

    try {
      const initResult = await api.createRepository(
        githubUrl.trim(),
        branch.trim() || undefined
      );
      onRepoAdded(initResult as unknown as Repository);
      setGithubUrl('');
      setBranch('');
      setIsModalOpen(false);

      // Poll until completed or failed (best-effort UX)
      let attempts = 0;
      const maxAttempts = 120; // ~4 minutes at 2s interval
      const poll = async () => {
        if (attempts >= maxAttempts) return;
        attempts += 1;
        try {
          const r = await api.getRepository(initResult.id);
          if (r.status === 'completed') setIndexingStatus(null);
          else if (r.status === 'failed') {
            setIndexingStatus('Ingestion failed — check the repo URL.');
            setTimeout(() => setIndexingStatus(null), 5000);
          } else {
            const next = r.status === 'pending' ? 'Cloning…' :
              r.status === 'cloning' ? 'Cloning…' :
              r.status === 'scanning' ? 'Scanning files…' :
              r.status === 'storing' ? 'Storing chunks…' :
              r.status === 'embedding' ? 'Embedding code…' :
              'Processing…';
            setIndexingStatus(next);
            setTimeout(poll, 2000);
          }
        } catch {
          setTimeout(poll, 4000);
        }
      };
      setTimeout(poll, 1500);
    } catch (err: any) {
      setErrorMessage(
        err?.details?.message || err.message || 'Failed to add repository'
      );
      setIndexingStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!repoToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteRepository(repoToDelete.id);
      if (onRepoDeleted) onRepoDeleted(repoToDelete.id);
      setRepoToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to remove repository');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Sidebar primitives ─────────────────────────────────────────────────
  /**
   * Sidebar nav link (Overview / Workspace / Docs).  Collapsed mode shows
   * just the icon with a tooltip; expanded shows icon + label.
   */
  const NavItem = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    title,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    title?: string;
  }) => {
    if (isCollapsed) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={title || label}
          className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors duration-100 ease-out cursor-pointer mx-auto ${
            isActive
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Icon className="w-4 h-4" />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-100 ease-out cursor-pointer ${
          isActive
            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
        }`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <>
      {/* ── Desktop Animated Collapsible Sidebar ──────────────────────── */}
      <motion.aside
        animate={{ width: isCollapsed ? 64 : 290 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden md:flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md z-20 shrink-0 select-none overflow-hidden h-full"
      >
        {/* ── Brand Header (logo + collapse) ──────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-3 min-h-[49px]">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.button
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                onClick={() => onNavigateTo('landing')}
                className="flex items-center gap-2 overflow-hidden whitespace-nowrap cursor-pointer"
                title="Sourcefinch — back to overview"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs shrink-0">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
                  Sourcefinch
                </span>
              </motion.button>
            )}
          </AnimatePresence>
          {isCollapsed && (
            <button
              type="button"
              onClick={() => onNavigateTo('landing')}
              title="Sourcefinch — back to overview"
              className="w-9 h-9 mx-auto rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs cursor-pointer hover:bg-teal-600 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-colors duration-100 cursor-pointer shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* When collapsed, expose the expand toggle on its own row. */}
        {isCollapsed && (
          <div className="px-3 -mt-1">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-9 h-8 mx-auto rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-colors duration-100 cursor-pointer"
              title="Expand sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Top-level nav (Overview, Workspace, Docs) ─────────────────── */}
        <div className={`px-2 ${isCollapsed ? 'py-1' : 'pt-1 pb-2'} space-y-0.5`}>
          <NavItem
            icon={Home}
            label="Overview"
            isActive={activeTab === 'landing'}
            onClick={() => onNavigateTo('landing')}
            title="Overview"
          />
          <NavItem
            icon={MessageSquare}
            label="Workspace"
            isActive={activeTab === 'workspace'}
            onClick={() => onNavigateTo('workspace')}
            title="Workspace"
          />
          <NavItem icon={BookOpen} label="Docs" onClick={onOpenDocs} title="Docs" />
        </div>

        {/* ── Repositories section header + add button ─────────────────── */}
        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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

          {!isCollapsed ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-2.5 py-1 text-[11.5px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100 cursor-pointer shadow-xs font-sans-ui whitespace-nowrap"
              title="Add a new GitHub repository"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Repo</span>
            </motion.button>
          ) : (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100 cursor-pointer shadow-xs mx-auto"
              title="Add GitHub repository"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Search Input (Expanded only) ──────────────────────────── */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 overflow-hidden"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-700 focus:outline-none transition-colors duration-100 font-sans-ui shadow-2xs"
                />
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Repository List ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-[var(--radius-md)] bg-zinc-100/70 dark:bg-zinc-800/40 animate-pulse"
                />
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-zinc-500 dark:text-zinc-400 font-sans-ui">
              {searchQuery
                ? 'No repositories match your search.'
                : 'No repositories yet. Click + Add Repo to ingest one.'}
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = selectedRepoId === repo.id;
              return (
                <div
                  key={repo.id}
                  className={`group relative rounded-[var(--radius-md)] p-2.5 flex items-center gap-2 cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? 'bg-zinc-100 dark:bg-zinc-800/80'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                  onClick={() => onSelectRepo(repo.id)}
                >
                  <div
                    className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-white truncate font-sans-ui">
                          {repo.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRepoToDelete(repo);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors duration-100 cursor-pointer"
                          title="Remove repository"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400 font-code">
                        <span className="truncate">{repo.branch || 'main'}</span>
                        <StatusDot
                          status={repo.status === 'completed' ? 'online' : 'muted'}
                          label={
                            repo.status === 'completed'
                              ? 'Ready'
                              : (repo.status || 'Pending')
                          }
                          className="text-[10.5px] !gap-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer: user (avatar + name + menu) ────────────────────────── */}
        <div
          className={`border-t border-zinc-200/60 dark:border-zinc-800/60 px-2 ${
            isCollapsed ? 'py-2' : 'py-2.5'
          }`}
        >
          <SidebarUserRow
            collapsed={isCollapsed}
            isSignedIn={isSignedIn}
            userLoaded={userLoaded}
            imageUrl={user?.imageUrl}
            firstName={user?.firstName}
            lastName={user?.lastName}
            username={user?.username}
            primaryEmail={user?.primaryEmailAddress?.emailAddress}
          />
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

              <div className="p-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-700 focus:outline-none transition-colors duration-100 font-sans-ui shadow-2xs"
                  />
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {/* Mobile nav quick links */}
                <div className="px-1.5 py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTo('landing');
                      onCloseMobile?.();
                    }}
                    className="w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors duration-100"
                  >
                    <Home className="w-3.5 h-3.5" />
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTo('workspace');
                      onCloseMobile?.();
                    }}
                    className="w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors duration-100"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDocs();
                      onCloseMobile?.();
                    }}
                    className="w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors duration-100"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Docs
                  </button>
                </div>

                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepoId === repo.id;
                  return (
                    <div
                      key={repo.id}
                      className={`rounded-[var(--radius-md)] p-2.5 flex items-center gap-2 cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-zinc-100 dark:bg-zinc-800/80'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                      onClick={() => {
                        onSelectRepo(repo.id);
                        onCloseMobile?.();
                      }}
                    >
                      <div
                        className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                          {repo.name}
                        </div>
                        <div className="text-xs text-zinc-500 font-code mt-1">
                          {repo.branch || 'main'} · {repo.file_count || 0} files
                        </div>
                      </div>
                    </div>
                  );
                })}
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

          <div className="flex items-center justify-end gap-2.5 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100 disabled:opacity-40 font-sans-ui"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !githubUrl.trim()}
              className="rounded-[var(--radius-sm)] bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100 shadow-xs disabled:opacity-40 font-sans-ui"
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
            className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100 disabled:opacity-40 font-sans-ui"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="rounded-[var(--radius-sm)] bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors duration-100 shadow-xs disabled:opacity-40 font-sans-ui"
          >
            {isDeleting ? 'Removing...' : 'Delete Repository'}
          </button>
        </div>
      </Modal>

      {/* ── Fullscreen Ingestion Modal (Smooth Progress) ─────────── */}
      {isSubmitting && (
        <RepoIngestionLoader
          repoName={githubUrl}
          statusText={indexingStatus || undefined}
        />
      )}
    </>
  );
}

// ── Sidebar user row (avatar + name + menu) ─────────────────────────────
/**
 * Renders the user identity strip at the bottom of the sidebar:
 *   [avatar] [name] [chevron/...]   ←  whole row opens Clerk user menu
 *
 * - Signed in: shows user image + name. Clicking the row opens the
 *   Clerk user menu (sign-out, profile, etc.) via the inline <UserButton/>.
 * - Signed out: shows a "Sign in" prompt via Clerk's <SignInButton/>.
 * - Collapsed mode: collapses to a 32px avatar circle only.
 */
function SidebarUserRow({
  collapsed,
  isSignedIn,
  userLoaded,
  imageUrl,
  firstName,
  lastName,
  username,
  primaryEmail,
}: {
  collapsed: boolean;
  isSignedIn: boolean | undefined;
  userLoaded: boolean;
  imageUrl?: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmail?: string | null;
}) {
  // Compose a friendly display name.  Falls back gracefully so the
  // row never shows "undefined" / "null" when claims are partial.
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    username ||
    primaryEmail?.split('@')[0] ||
    'Signed in';

  const initials =
    [firstName?.[0], lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    (primaryEmail?.[0] ?? '?').toUpperCase();

  if (collapsed) {
    return (
      <div className="flex justify-center">
        {isSignedIn ? (
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { avatarBox: 'h-8 w-8' },
            }}
          />
        ) : (
          <SignInButton mode="modal" forceRedirectUrl="/workspace">
            <button
              type="button"
              title="Sign in"
              className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors duration-100 cursor-pointer"
            >
              {initials}
            </button>
          </SignInButton>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {isSignedIn ? (
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              // Hide Clerk's default avatar box — our custom row is the visual.
              userButtonBox: 'hidden',
              userButtonOuterBox: 'hidden',
            },
          }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer"
            aria-label="Open account menu"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={displayName}
                className="h-7 w-7 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800 shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center text-[11px] font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-zinc-900 dark:text-white truncate font-sans-ui">
                {userLoaded ? displayName : '…'}
              </div>
              {primaryEmail && (
                <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate font-sans-ui">
                  {primaryEmail}
                </div>
              )}
            </div>
          </button>
        </UserButton>
      ) : (
        <SignInButton mode="modal" forceRedirectUrl="/workspace">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer"
          >
            <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-zinc-900 dark:text-white truncate font-sans-ui">
                {userLoaded ? 'Sign in' : '…'}
              </div>
              <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate font-sans-ui">
                Continue to workspace
              </div>
            </div>
          </button>
        </SignInButton>
      )}
    </div>
  );
}