"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  X,
  Home,
  MessageSquare,
  BookOpen,
  Settings,
  Sun,
  Moon,
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
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
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
  theme,
  setTheme,
}: SidebarProps) {
  const api = useApiClient();
  const { isSignedIn, user, isLoaded: userLoaded } = useUser();

  // ── Expand/collapse state (Replit: hover-expand + pinned) ─────────────
  // isPinned is read below (line 74) to compute isExpanded. The setter is
  // intentionally omitted until a pin toggle UI is added; keep the state
  // declaration so the existing read site stays valid.
  const [isPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safely close user menu tracking when clicking outside Clerk dropdown
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.cl-userButtonPopoverCard') && !target.closest('.cl-modalBackdrop') && !target.closest('.cl-userButton-root')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Safely close settings tracking when clicking outside settings card
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleSettingsClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (settingsRef.current && !settingsRef.current.contains(target) && !target.closest('.settings-toggle-btn')) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleSettingsClick);
    return () => document.removeEventListener('mousedown', handleSettingsClick);
  }, [isSettingsOpen]);

  const isExpanded = isPinned || isHovered || isUserMenuOpen || isSettingsOpen;

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 60);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      const clerkPopup = document.querySelector('.cl-userButtonPopoverCard, .cl-modalBackdrop');
      if (!clerkPopup && !isSettingsOpen) {
        setIsHovered(false);
        setIsUserMenuOpen(false);
      }
    }, 200);
  }, [isSettingsOpen]);

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
      const maxAttempts = 120;
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

  // ── User display info ─────────────────────────────────────────────────
  const firstName = user?.firstName;
  const lastName = user?.lastName;
  const username = user?.username;
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;
  const imageUrl = user?.imageUrl;

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

  // ── Nav Item (works both collapsed & expanded) ────────────────────────
  const NavItem = ({
    icon: Icon,
    label,
    isActive,
    onClick,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isActive?: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      className={`group/nav relative flex items-center gap-2.5 rounded-xl transition-all duration-150 cursor-pointer font-sans-ui ${
        isExpanded ? 'w-full px-3 py-2' : 'w-10 h-10 justify-center'
      } ${
        isActive
          ? 'bg-zinc-200/80 dark:bg-white/[0.12] text-zinc-900 dark:text-white font-semibold'
          : 'text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-zinc-200'
      }`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {isExpanded && (
        <span className="text-[13px] truncate">{label}</span>
      )}
      {/* Tooltip (collapsed only) */}
      {!isExpanded && (
        <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 text-[11px] font-medium text-white bg-zinc-800 dark:bg-zinc-900 rounded-lg border border-zinc-700 dark:border-zinc-800 shadow-lg opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* ── Desktop: Animated Collapsible Sidebar (Replit-style) ──────── */}
      <motion.aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{ width: isExpanded ? 260 : 56 }}
        className={`relative hidden md:flex flex-col border-r border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl z-30 shrink-0 select-none h-full ${
          isExpanded ? 'overflow-visible' : 'overflow-hidden'
        }`}
      >
        {/* ── Brand Header ───────────────────────────────────────────── */}
        <div className={`flex items-center ${isExpanded ? 'px-3 py-3 gap-2.5' : 'px-2 py-3 justify-center'} min-h-[52px]`}>
          <button
            type="button"
            onClick={() => onNavigateTo('landing')}
            title="Sourcefinch — Home"
            className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-all duration-200 shrink-0 shadow-sm"
          >
            <img src="/logo2.png" alt="Sourcefinch" className="w-8 h-8 object-contain rounded-lg dark:hidden" />
            <img src="/logo.png" alt="Sourcefinch" className="w-8 h-8 object-contain rounded-lg hidden dark:block" />
          </button>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui whitespace-nowrap"
            >
              Sourcefinch
            </motion.span>
          )}
        </div>

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className={`${isExpanded ? 'px-2' : 'px-1.5'} py-1 space-y-0.5`}>
          <NavItem
            icon={Home}
            label="Overview"
            isActive={activeTab === 'landing'}
            onClick={() => onNavigateTo('landing')}
          />
          <NavItem
            icon={MessageSquare}
            label="Workspace"
            isActive={activeTab === 'workspace'}
            onClick={() => onNavigateTo('workspace')}
          />
          <NavItem
            icon={BookOpen}
            label="Docs"
            onClick={onOpenDocs}
          />
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className={`${isExpanded ? 'mx-3' : 'mx-2.5'} h-px bg-zinc-200 dark:bg-white/[0.06] my-2`} />

        {/* ── Repositories Section ───────────────────────────────────── */}
        <div className={`${isExpanded ? 'px-3' : 'px-1.5'} flex items-center justify-between mb-1.5`}>
          {isExpanded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-sans-ui">
                Repositories
              </span>
              <span className="font-code text-[11px] rounded-md bg-zinc-200/80 dark:bg-white/[0.06] border border-zinc-300/50 dark:border-white/[0.08] px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 font-medium">
                {uniqueRepos.length}
              </span>
            </motion.div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="Add Repository"
            className={`rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer ${
              isExpanded
                ? 'gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white px-2.5 py-1 text-[11px] font-semibold hover:from-orange-600 hover:to-amber-700 shadow-sm shadow-orange-500/20 font-sans-ui'
                : 'w-10 h-10 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-zinc-200 mx-auto'
            }`}
          >
            <Plus className={isExpanded ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} />
            {isExpanded && <span>Add Repo</span>}
          </button>
        </div>

        {/* ── Search (expanded only) ─────────────────────────────────── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 pb-2 overflow-hidden"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-white/[0.15] focus:outline-none transition-colors duration-100 font-sans-ui shadow-sm dark:shadow-none"
                />
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Repository List ────────────────────────────────────────── */}
        <div className={`flex-1 overflow-y-auto ${isExpanded ? 'px-2' : 'px-1.5'} pb-2 space-y-0.5`}>
          {isLoading ? (
            <div className="p-2 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse ${isExpanded ? 'h-12' : 'h-10 w-10 mx-auto'}`}
                />
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            isExpanded ? (
              <div className="p-4 text-center text-[11px] text-zinc-500 dark:text-zinc-500 font-sans-ui">
                {searchQuery
                  ? 'No repositories match your search.'
                  : 'No repositories yet. Click + Add Repo.'}
              </div>
            ) : null
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = selectedRepoId === repo.id;
              return (
                <div
                  key={repo.id}
                  className={`group relative rounded-lg flex items-center cursor-pointer transition-all duration-100 ${
                    isExpanded ? 'p-2.5 gap-2.5' : 'w-10 h-10 justify-center mx-auto'
                  } ${
                    isSelected
                      ? 'bg-zinc-200/80 dark:bg-white/[0.08] border border-zinc-300/50 dark:border-white/[0.06]'
                      : 'hover:bg-zinc-100 dark:hover:bg-white/[0.04] border border-transparent'
                  }`}
                  onClick={() => onSelectRepo(repo.id)}
                  title={!isExpanded ? repo.name : undefined}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white'
                        : 'bg-zinc-200/80 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                  </div>
                  {isExpanded && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-200 truncate font-sans-ui">
                          {repo.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRepoToDelete(repo);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-all duration-100 cursor-pointer"
                          title="Remove repository"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-500 font-code">
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

        {/* ── Settings Popover (Desktop) ─────────────────────────────────── */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div ref={settingsRef}>
              <SettingsPopover
                theme={theme}
                setTheme={setTheme}
                onOpenDocs={onOpenDocs}
                onClose={() => setIsSettingsOpen(false)}
                className={isExpanded ? 'left-2 right-2' : 'left-14 w-72'}
              />
            </div>
          )}
        </AnimatePresence>

        {/* ── Footer: User & Settings ──────────────────────────────────── */}
        <div className={`border-t border-zinc-200/70 dark:border-white/[0.06] ${isExpanded ? 'px-2 py-2.5' : 'px-1.5 py-2'}`}>
          {isExpanded ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <SidebarUserRowExpanded
                  isSignedIn={isSignedIn}
                  userLoaded={userLoaded}
                  imageUrl={imageUrl}
                  displayName={displayName}
                  initials={initials}
                  primaryEmail={primaryEmail}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className={`settings-toggle-btn p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                  isSettingsOpen
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                }`}
                title="Settings & Appearance"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              {isSignedIn ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: { avatarBox: 'h-8 w-8 rounded-xl' },
                  }}
                />
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/workspace">
                  <button
                    type="button"
                    title="Sign in"
                    className="h-8 w-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors duration-100 cursor-pointer"
                  >
                    {initials}
                  </button>
                </SignInButton>
              )}
            </div>
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
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 w-80 shadow-2xl bg-white dark:bg-zinc-950 z-40 md:hidden flex flex-col border-r border-zinc-200 dark:border-white/[0.06]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <img src="/logo2.png" alt="Sourcefinch" className="w-7 h-7 object-contain rounded-lg shadow-sm dark:hidden" />
                  <img src="/logo.png" alt="Sourcefinch" className="w-7 h-7 object-contain rounded-lg shadow-sm hidden dark:block" />
                  <span className="text-[14px] font-semibold text-zinc-900 dark:text-white font-sans-ui">Sourcefinch</span>
                </div>
                <button type="button" onClick={onCloseMobile} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile nav */}
              <div className="px-2 py-2 space-y-0.5 border-b border-zinc-200 dark:border-white/[0.06]">
                {[
                  { icon: Home, label: 'Overview', tab: 'landing' as const },
                  { icon: MessageSquare, label: 'Workspace', tab: 'workspace' as const },
                ].map(({ icon: Icon, label, tab }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { onNavigateTo(tab); onCloseMobile?.(); }}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors duration-100 font-sans-ui ${
                      activeTab === tab
                        ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { onOpenDocs(); onCloseMobile?.(); }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-100 font-sans-ui"
                >
                  <BookOpen className="w-4 h-4" />
                  Docs
                </button>
              </div>

              {/* Mobile repos */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-sans-ui">Repositories</span>
                  <span className="font-code text-[11px] rounded-md bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 font-medium">{uniqueRepos.length}</span>
                </div>
                <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 text-white px-2.5 py-1 text-xs font-semibold shadow-sm">
                  <Plus className="w-3.5 h-3.5" /><span>Add Repo</span>
                </button>
              </div>

              <div className="px-3 pb-2">
                <div className="relative">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search repositories..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-1.5 pl-8 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-white/[0.15] focus:outline-none transition-colors duration-100 font-sans-ui" />
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepoId === repo.id;
                  return (
                    <div key={repo.id} className={`rounded-lg p-2.5 flex items-center gap-2.5 cursor-pointer transition-all duration-100 ${isSelected ? 'bg-zinc-100 dark:bg-white/[0.08]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.04]'}`}
                      onClick={() => { onSelectRepo(repo.id); onCloseMobile?.(); }}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white' : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400'}`}>
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-200 truncate font-sans-ui">{repo.name}</div>
                        <div className="text-xs text-zinc-500 font-code mt-0.5">{repo.branch || 'main'} · {repo.file_count || 0} files</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Settings Popover (Mobile) ─────────────────────────────────── */}
              <AnimatePresence>
                {isSettingsOpen && (
                  <div ref={settingsRef}>
                    <SettingsPopover
                      theme={theme}
                      setTheme={setTheme}
                      onOpenDocs={onOpenDocs}
                      onClose={() => setIsSettingsOpen(false)}
                      className="left-3 right-3"
                    />
                  </div>
                )}
              </AnimatePresence>

              {/* Mobile user footer */}
              <div className="border-t border-zinc-200 dark:border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <SidebarUserRowExpanded isSignedIn={isSignedIn} userLoaded={userLoaded} imageUrl={imageUrl} displayName={displayName} initials={initials} primaryEmail={primaryEmail} />
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className={`settings-toggle-btn p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                    isSettingsOpen
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                  }`}
                  title="Settings & Appearance"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Add Repository Modal ──────────────────────────────────────── */}
      <Modal open={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} size="md">
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans-ui">Add GitHub Repository</h3>
        </div>
        <form onSubmit={handleAddRepo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 font-sans-ui">
              GitHub Repository URL <span className="text-rose-500">*</span>
            </label>
            <input type="text" required placeholder="https://github.com/owner/repository" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} disabled={isSubmitting}
              className="w-full rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400/40 font-sans-ui transition-colors duration-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 font-sans-ui">
              Branch <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input type="text" placeholder="main, master, etc." value={branch} onChange={(e) => setBranch(e.target.value)} disabled={isSubmitting}
              className="w-full rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400/40 font-sans-ui transition-colors duration-100" />
          </div>
          {errorMessage && (
            <div className="rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 font-sans-ui">{errorMessage}</div>
          )}
          <div className="flex items-center justify-end gap-2.5 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}
              className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100 disabled:opacity-40 font-sans-ui">Cancel</button>
            <button type="submit" disabled={isSubmitting || !githubUrl.trim()}
              className="rounded-[var(--radius-sm)] bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-2 text-xs font-semibold hover:from-orange-600 hover:to-amber-700 transition-all duration-100 shadow-sm shadow-orange-500/20 disabled:opacity-40 font-sans-ui">
              {isSubmitting ? 'Submitting...' : 'Ingest Repository'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      <Modal open={!!repoToDelete} onClose={() => !isDeleting && setRepoToDelete(null)} size="sm"
        title={<span className="flex items-center gap-2 text-sm font-semibold font-sans-ui"><span className="w-7 h-7 rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></span>Remove Repository</span>}>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-sans-ui">This action cannot be undone.</p>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 mb-4 leading-relaxed font-sans-ui">
          Are you sure you want to remove{' '}<span className="font-semibold text-zinc-900 dark:text-white">{repoToDelete?.name}</span>? All indexed chunks and metadata will be permanently deleted.
        </p>
        {deleteError && (<div className="rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-400 mb-4 font-sans-ui">{deleteError}</div>)}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => !isDeleting && setRepoToDelete(null)} disabled={isDeleting}
            className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100 disabled:opacity-40 font-sans-ui">Cancel</button>
          <button type="button" onClick={handleConfirmDelete} disabled={isDeleting}
            className="rounded-[var(--radius-sm)] bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors duration-100 shadow-xs disabled:opacity-40 font-sans-ui">{isDeleting ? 'Removing...' : 'Delete Repository'}</button>
        </div>
      </Modal>

      {/* ── Fullscreen Ingestion Modal ────────────────────────────────── */}
      {isSubmitting && (
        <RepoIngestionLoader repoName={githubUrl} statusText={indexingStatus || undefined} />
      )}
    </>
  );
}

// ── Expanded user row (shared by desktop expanded & mobile) ──────────────
function SidebarUserRowExpanded({
  isSignedIn, userLoaded, imageUrl, displayName, initials, primaryEmail,
}: {
  isSignedIn: boolean | undefined;
  userLoaded: boolean;
  imageUrl?: string;
  displayName: string;
  initials: string;
  primaryEmail?: string | null;
}) {
  if (isSignedIn) {
    return (
      <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonBox: 'hidden', userButtonOuterBox: 'hidden' } }}>
        <button type="button" className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer" aria-label="Open account menu">
          {imageUrl ? (
            <img src={imageUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center text-[11px] font-semibold shrink-0">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-zinc-900 dark:text-white truncate font-sans-ui">{userLoaded ? displayName : '…'}</div>
            {primaryEmail && <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate font-sans-ui">{primaryEmail}</div>}
          </div>
        </button>
      </UserButton>
    );
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/workspace">
      <button type="button" className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer">
        <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-zinc-900 dark:text-white truncate font-sans-ui">Sign in</div>
          <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate font-sans-ui">Continue to workspace</div>
        </div>
      </button>
    </SignInButton>
  );
}

// ── Settings & Appearance Popover ─────────────────────────────────────────
function SettingsPopover({
  theme,
  setTheme,
  onOpenDocs,
  onClose,
  className = '',
}: {
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
  onOpenDocs: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute bottom-16 z-50 rounded-2xl border border-zinc-200/90 dark:border-white/[0.1] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-3.5 shadow-xl shadow-black/10 dark:shadow-black/40 font-sans-ui text-zinc-900 dark:text-zinc-100 select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-zinc-300">
            <Settings className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-wide">Settings & Preferences</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
          title="Close settings"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Appearance Section */}
      <div className="py-3 border-b border-zinc-100 dark:border-white/[0.06]">
        <div className="mb-2.5">
          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Theme Mode</div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {theme === 'dark' ? 'Dark mode active' : 'Light mode active'}
          </div>
        </div>

        {/* Light / Dark Segmented Buttons */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => setTheme?.('light')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              theme !== 'dark'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme?.('dark')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Quick Actions & Help */}
      <div className="pt-2.5 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenDocs();
          }}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-left font-medium"
        >
          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span>Documentation & Guide</span>
        </button>

        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-sans-ui">
          <span>Send message</span>
          <span className="font-code text-[10px] bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">Return ↵</span>
        </div>
      </div>
    </motion.div>
  );
}